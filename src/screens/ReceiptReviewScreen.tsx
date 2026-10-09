import { requestUri, settlementAmounts } from "../domain/settlement";
import { prepareDevnetPayment } from "../domain/prepare-devnet-payment";
import { encodeBase58 } from "../domain/base58";
import { useMobileWallet } from "../utils/useMobileWallet";
import { useAuthorization } from "../utils/useAuthorization";
import { useCluster, ClusterNetwork } from "../components/cluster/cluster-data-access";
import { findPayment, verifyPaymentSignature } from "../domain/payment-verification";
import React, { useEffect, useRef, useState } from "react";
import { Alert, Linking, ScrollView, Share, StatusBar, StyleSheet, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import * as Crypto from "expo-crypto";
import { PublicKey, LAMPORTS_PER_SOL, Transaction, ComputeBudgetInstruction, ComputeBudgetProgram } from "@solana/web3.js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Button, Chip, Surface, Text, TextInput } from "react-native-paper";
import { useNavigation, useRoute } from "@react-navigation/native";

type ReceiptItem = { name: string; price: number };
type SplitMode = "equal" | "items";
type PaymentResult = { context: string; message: string; signature?: string };

export function ReceiptReviewScreen() {
  const mobileWallet = useMobileWallet();
  const { selectedAccount } = useAuthorization();
  const { selectedCluster } = useCluster();
  const [sendingDevnet, setSendingDevnet] = useState<string | null>(null);
  const devnetPaymentLock = useRef(false);
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const [savedItems, setSavedItems] = useState<ReceiptItem[]>([]);
  const items: ReceiptItem[] = route.params?.items ?? savedItems;

  const [personName, setPersonName] = useState("");
  const [people, setPeople] = useState<string[]>([]);
  const [mode, setMode] = useState<SplitMode>("equal");
  const [assignments, setAssignments] = useState<Record<number, string[]>>({});
  const [recipientAddress, setRecipientAddress] = useState("");
  const [paymentToken, setPaymentToken] = useState<"USDC" | "SKR">("USDC");
  const [paymentNetwork, setPaymentNetwork] = useState<"mainnet" | "devnet">("mainnet");
  const [skrRate, setSkrRate] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [reviewLoaded, setReviewLoaded] = useState(false);
  const [paymentResults, setPaymentResults] = useState<Record<string, PaymentResult>>({});
  const [checkingPerson, setCheckingPerson] = useState<string | null>(null);
  const [signatureInputs, setSignatureInputs] = useState<Record<string, string>>({});
  const checkInProgress = useRef(false);
  const referenceTasks = useRef(new Map<string, Promise<string>>());
  const [requestSession, setRequestSession] = useState(() => new PublicKey(Crypto.getRandomBytes(32)).toBase58());

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem("snapsplit-items"),
      AsyncStorage.getItem("snapsplit-review"),
    ])
      .then(([savedItemData, savedReviewData]) => {
        if (savedItemData) {
          const parsedItems = JSON.parse(savedItemData);
          if (Array.isArray(parsedItems)) setSavedItems(parsedItems);
        }
        if (savedReviewData) {
          const saved = JSON.parse(savedReviewData);
          if (saved.paymentNetwork === "mainnet" || saved.paymentNetwork === "devnet") {
            setPaymentNetwork(saved.paymentNetwork);
          }
          if (saved.paymentToken === "USDC" || saved.paymentToken === "SKR") {
            setPaymentToken(saved.paymentNetwork === "devnet" ? "USDC" : saved.paymentToken);
          }
          if (typeof saved.skrRate === "string") setSkrRate(saved.skrRate);
          if (saved.paymentResults && typeof saved.paymentResults === "object" && !Array.isArray(saved.paymentResults)) setPaymentResults(saved.paymentResults);
          if (typeof saved.requestSession === "string") setRequestSession(saved.requestSession);
          if (Array.isArray(saved.people)) setPeople(saved.people);
          if (saved.mode === "equal" || saved.mode === "items") setMode(saved.mode);
          if (saved.assignments && typeof saved.assignments === "object") {
            setAssignments(saved.assignments);
          }
          if (typeof saved.recipientAddress === "string") {
            setRecipientAddress(saved.recipientAddress);
          }
        }
      })
      .catch((error) => console.warn("Could not load split", error))
      .finally(() => setReviewLoaded(true));
  }, []);

  useEffect(() => {
    if (!reviewLoaded || route.params?.resetSplit) return;
    AsyncStorage.setItem(
      "snapsplit-review",
      JSON.stringify({ people, mode, assignments, recipientAddress, requestSession, paymentResults, paymentNetwork, paymentToken, skrRate })
    ).catch((error) => console.warn("Could not save split", error));
  }, [people, mode, assignments, recipientAddress, requestSession, paymentResults, paymentNetwork, paymentToken, skrRate, reviewLoaded, route.params?.resetSplit]);

  useEffect(() => {
    if (!reviewLoaded || !route.params?.resetSplit) return;

    setRequestSession(new PublicKey(Crypto.getRandomBytes(32)).toBase58());
    setPersonName("");
    setPeople([]);
    setMode("equal");
    setAssignments({});
    navigation.setParams({ resetSplit: false });
  }, [reviewLoaded, route.params?.resetSplit, navigation]);

  useEffect(() => { setPreview(null); }, [items, people, mode, assignments, recipientAddress, paymentToken, skrRate, paymentNetwork]);

  const totalCents = items.reduce(
    (sum, item) => sum + Math.round(item.price * 100),
    0
  );

  function addPerson() {
    const name = personName.trim();
    if (!name || people.some((person) => person.toLowerCase() === name.toLowerCase())) {
      return;
    }
    setPeople([...people, name]);
    setPersonName("");
  }

  function removePerson(name: string) {
    setPeople((current) => current.filter((person) => person !== name));
    setAssignments((current) => {
      const next: Record<number, string[]> = {};
      for (const [index, assigned] of Object.entries(current)) {
        next[Number(index)] = assigned.filter((person) => person !== name);
      }
      return next;
    });
  }

  function toggleAssignment(itemIndex: number, person: string) {
    setAssignments((current) => {
      const assigned = current[itemIndex] ?? [];
      return {
        ...current,
        [itemIndex]: assigned.includes(person)
          ? assigned.filter((name) => name !== person)
          : [...assigned, person],
      };
    });
  }

  function amountFor(person: string): number {
    if (mode === "equal") {
      if (people.length === 0) return 0;
      const index = people.indexOf(person);
      return Math.floor(totalCents / people.length) +
        (index < totalCents % people.length ? 1 : 0);
    }

    return items.reduce((sum, item, itemIndex) => {
      const assigned = assignments[itemIndex] ?? [];
      const position = assigned.indexOf(person);
      if (position === -1) return sum;

      const cents = Math.round(item.price * 100);
      return sum + Math.floor(cents / assigned.length) +
        (position < cents % assigned.length ? 1 : 0);
    }, 0);
  }

  function paymentContext(person: string, amount: string): string {
    return JSON.stringify({
      requestSession, items, people, mode, assignments,
      address: recipientAddress.trim(), paymentToken, paymentNetwork, amount, person
    });
  }

  function displayedPaymentResult(person: string): PaymentResult | undefined {
    try {
      const amount = settlementAmounts(
        people.map(amountFor), paymentToken, skrRate
      )[people.indexOf(person)];
      const result = paymentResults[person];
      return result?.context === paymentContext(person, amount) ? result : undefined;
    } catch {
      return undefined;
    }
  }

  async function claimSignature(
    signature: string, network: string, context: string
  ) {
    const key = "snapsplit-used-payment-" + network + "-" + signature;
    const previous = await AsyncStorage.getItem(key);
    if (previous && previous !== context) {
      throw new Error("This transaction is already assigned to another request on this device.");
    }
    await AsyncStorage.setItem(key, context);
  }

  async function checkSignature(person: string) {
    if (checkInProgress.current) return;
    const signature = (signatureInputs[person] ?? "").trim();
    if (!signature) {
      Alert.alert("Transaction signature", "Paste the signature from the payer's transaction.");
      return;
    }
    checkInProgress.current = true;
    setCheckingPerson(person);
    try {
      const request = await paymentRequestFor(person);
      if (!request) return;
      const valid = await verifyPaymentSignature(signature, {
        recipient: request.recipient,
        reference: request.reference,
        amount: request.amount,
        token: request.token,
        network: request.network,
      });
      if (!valid) {
        Alert.alert(
          "Transfer does not match",
          "No matching finalized transfer with this recipient, token and exact amount was found."
        );
        return;
      }
      await claimSignature(signature, request.network, request.context);
      setPaymentResults(current => ({
        ...current,
        [person]: {
          context: request.context,
          message: "Transfer verified on-chain by signature; manually assigned to " + person + ".",
          signature,
        },
      }));
    } catch (error) {
      Alert.alert(
        "Signature check unavailable",
        error instanceof Error ? error.message : "Could not verify the transfer."
      );
    } finally {
      checkInProgress.current = false;
      setCheckingPerson(null);
    }
  }

  async function checkPayment(person: string) {
    if (checkInProgress.current) return;
    checkInProgress.current = true;
    setCheckingPerson(person);
    try {
      const request = await paymentRequestFor(person);
      if (!request) return;
      const signature = await findPayment({
        recipient: request.recipient,
        reference: request.reference,
        amount: request.amount,
        token: request.token,
        network: request.network,
      });
      if (signature) {
        await claimSignature(signature, request.network, request.context);
      }
      setPaymentResults(current => ({
        ...current,
        [person]: {
          context: request.context,
          message: signature
            ? "Paid - finalized on-chain"
            : "No matching finalized payment found. If just sent, check again shortly.",
          ...(signature ? { signature } : {}),
        },
      }));
    } catch (error) {
      Alert.alert(
        "Payment check unavailable",
        error instanceof Error ? error.message : "Could not contact Solana RPC. Try again."
      );
    } finally {
      checkInProgress.current = false;
      setCheckingPerson(null);
    }
  }

  async function paymentRequestFor(person: string): Promise<{
    url: string; amount: string; reference: string; context: string;
    recipient: string; token: "USDC" | "SKR"; network: "mainnet" | "devnet";
  } | null> {
    if (!reviewLoaded) return null;
    const address = recipientAddress.trim();
    try {
      new PublicKey(address);
    } catch {
      Alert.alert("Invalid wallet", "Enter a valid Solana recipient address.");
      return null;
    }

    const cents = amountFor(person);
    if (cents <= 0) {
      Alert.alert("No amount", "This person has no assigned amount.");
      return null;
    }

    if (unassignedCount > 0) { Alert.alert("Assign all items", "Complete the split before requesting payment."); return null; }
    let amount: string;
    try {
      amount = settlementAmounts(people.map(amountFor), paymentToken, skrRate)[people.indexOf(person)];
      const identity = paymentContext(person, amount);
      const digest = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256, identity
      );
      const storageKey = "snapsplit-payment-reference-" + digest;
      let task = referenceTasks.current.get(storageKey);
      if (!task) {
        task = (async () => {
          const savedReference = await AsyncStorage.getItem(storageKey);
          if (savedReference) {
            new PublicKey(savedReference);
            return savedReference;
          }
          const created = new PublicKey(Crypto.getRandomBytes(32)).toBase58();
          await AsyncStorage.setItem(storageKey, created);
          return created;
        })();
        referenceTasks.current.set(storageKey, task);
      }
      let reference: string;
      try {
        reference = await task;
      } catch (error) {
        referenceTasks.current.delete(storageKey);
        throw error;
      }
      const url = requestUri(address, paymentToken, amount, person, paymentNetwork, reference);
      return { url, amount, reference, context: identity, recipient: address, token: paymentToken, network: paymentNetwork };
    } catch (error) { Alert.alert("Check settlement rate", error instanceof Error ? error.message : "Invalid settlement."); return null; }


  }

  async function payWithPhantom(person: string) {
    if (devnetPaymentLock.current) return;

    if (
      paymentNetwork !== "devnet" ||
      paymentToken !== "USDC" ||
      selectedCluster.network !== ClusterNetwork.Devnet
    ) {
      Alert.alert("Network mismatch", "Devnet demo and Devnet wallet network are required.");
      return;
    }

    devnetPaymentLock.current = true;
    setSendingDevnet(person);

    let handedToConfirmation = false;

    try {
      const request = await paymentRequestFor(person);

      if (!request || request.network !== "devnet" || request.token !== "USDC") {
        return;
      }

      const owner = selectedAccount?.publicKey;

      if (!owner) {
        throw new Error(
          "Connect Phantom from the Home screen first, then return to Split."
        );
      }
      const recipient = new PublicKey(request.recipient);
      const reference = new PublicKey(request.reference);

      const prepared = await prepareDevnetPayment({
        owner,
        recipient,
        reference,
        amount: request.amount,
      });

      const message = prepared.transaction.compileMessage();

      const feeResult = await prepared.connection.getFeeForMessage(
        message,
        "confirmed"
      );

      if (feeResult.value === null) {
        throw new Error("Could not estimate Devnet transaction fee.");
      }

      const createsAta = prepared.transaction.instructions.length > 1;

      const ataRent = createsAta
        ? await prepared.connection.getMinimumBalanceForRentExemption(165)
        : 0;

      const totalSolCost = ataRent + feeResult.value;
      const solBalance = await prepared.connection.getBalance(owner);

      if (solBalance < totalSolCost) {
        throw new Error("Insufficient Devnet SOL for transaction fees and account rent.");
      }

      handedToConfirmation = true;

      Alert.alert(
        "Review Devnet test payment",
        `Send: ${request.amount} test USDC\n` +
        `Recipient: ${recipient.toBase58()}\n\n` +
        `ATA rent: ${(ataRent / LAMPORTS_PER_SOL).toFixed(9)} Devnet SOL\n` +
        `Network fee: ${(feeResult.value / LAMPORTS_PER_SOL).toFixed(9)} Devnet SOL\n` +
        `Total SOL cost: ${(totalSolCost / LAMPORTS_PER_SOL).toFixed(9)}\n\n` +
        `Devnet test tokens have no monetary value.`,
        [
          {
            text: "Cancel",
            style: "cancel",
            onPress: () => {
              devnetPaymentLock.current = false;
              setSendingDevnet(null);
            },
          },
          {
            text: "Continue to Phantom",
            onPress: async () => {
              try {
                const pendingKey =
                  "snapsplit-pending-devnet-" + request.reference;

                const existingPending =
                  await AsyncStorage.getItem(pendingKey);

                if (existingPending) {
                  // An old signed transaction must NOT be blindly retried or erased.
                  const previous: unknown = JSON.parse(existingPending);
                  if (
                    !previous || typeof previous !== "object" ||
                    !("status" in previous) || previous.status !== "signed" ||
                    !("signedTransaction" in previous) ||
                    typeof previous.signedTransaction !== "string" ||
                    !("reference" in previous) || previous.reference !== request.reference ||
                    !("recipient" in previous) || previous.recipient !== request.recipient ||
                    !("amount" in previous) || previous.amount !== request.amount
                  ) {
                    throw new Error(
                      "An earlier payment requires manual review. Do not pay again yet."
                    );
                  }

                  const oldTransaction = Transaction.from(
                    Buffer.from(previous.signedTransaction, "base64")
                  );
                  if (!oldTransaction.verifySignatures() ||
                      !oldTransaction.signature || !oldTransaction.recentBlockhash) {
                    throw new Error("Stored transaction could not be verified. Payment blocked.");
                  }
                  const oldSignature = encodeBase58(oldTransaction.signature);
                  const oldStatus = await prepared.connection.getSignatureStatuses(
                    [oldSignature], { searchTransactionHistory: true }
                  );
                  if (oldStatus.value[0]) {
                    throw new Error(
                      "Earlier transaction exists on Devnet (" + oldSignature +
                      "). Review it before making another payment."
                    );
                  }
                  const matchingPayment = await findPayment({
                    recipient: request.recipient,
                    reference: request.reference,
                    amount: request.amount,
                    token: request.token,
                    network: request.network,
                  });
                  if (matchingPayment) {
                    throw new Error(
                      "This payment was already completed on-chain: " + matchingPayment
                    );
                  }
                  const stillValid = await prepared.connection.isBlockhashValid(
                    oldTransaction.recentBlockhash, { commitment: "confirmed" }
                  );
                  if (stillValid.value) {
                    throw new Error(
                      "Previous signed transaction is still valid. Wait and check again."
                    );
                  }

                  // Only after chain checks AND blockhash expiry: retain evidence,
                  // then let the user explicitly initiate a new approval next time.
                  const archiveKey = "snapsplit-expired-devnet-" +
                    request.reference + "-" + oldSignature;
                  await AsyncStorage.setItem(archiveKey, JSON.stringify({
                    ...previous,
                    status: "expired",
                    signature: oldSignature,
                    archivedAt: Date.now(),
                  }));
                  await AsyncStorage.removeItem(pendingKey);
                  Alert.alert(
                    "Expired request archived",
                    "No matching payment was found, and the old blockhash has expired. " +
                    "The old signed transaction was preserved for audit. " +
                    "Tap Pay with Phantom again to create a NEW signed transaction."
                  );
                  return;
                }

                // Fetch the blockhash INSIDE the MWA session, AFTER wallet consent.
                const { signed, latestBlockhash: freshBlockhash } =
                  await mobileWallet.signOnlyForAccount(
                    prepared.transaction,
                    owner,
                    prepared.connection
                  );

                // Permit only bounded compute-budget instructions
                // prepended by the wallet.
                const budgetProgram = ComputeBudgetProgram.programId;

                const budgetInstructions = signed.instructions.filter(
                  (ix) => ix.programId.equals(budgetProgram)
                );

                if (
                  budgetInstructions.length > 2 ||
                  !signed.instructions
                    .slice(0, budgetInstructions.length)
                    .every((ix) => ix.programId.equals(budgetProgram))
                ) {
                  throw new Error("Unexpected wallet instructions.");
                }

                let computeLimit = 200000;
                let computePrice = 0n;
                let hasLimit = false;
                let hasPrice = false;

                for (const ix of budgetInstructions) {
                  if (ix.keys.length !== 0) {
                    throw new Error("Invalid fee instruction accounts.");
                  }

                  const type =
                    ComputeBudgetInstruction.decodeInstructionType(ix);

                  if (type === "SetComputeUnitLimit" && !hasLimit) {
                    computeLimit =
                      ComputeBudgetInstruction.decodeSetComputeUnitLimit(ix).units;
                    hasLimit = true;
                  } else if (type === "SetComputeUnitPrice" && !hasPrice) {
                    computePrice = BigInt(
                      ComputeBudgetInstruction.decodeSetComputeUnitPrice(ix)
                        .microLamports
                    );
                    hasPrice = true;
                  } else {
                    throw new Error("Unsupported wallet fee instruction.");
                  }
                }

                const priorityFee =
                  (BigInt(computeLimit) * computePrice + 999999n) /
                  1000000n;

                if (
                  !Number.isInteger(computeLimit) ||
                  computeLimit < 1 ||
                  computeLimit > 400000 ||
                  priorityFee > 100000n
                ) {
                  throw new Error("Wallet priority fee exceeds limit.");
                }

                const original = prepared.transaction.instructions;
                const actual = signed.instructions.slice(
                  budgetInstructions.length
                );

                const samePayment =
                  signed.feePayer?.equals(owner) === true &&
                  prepared.transaction.feePayer?.equals(owner) === true &&
                  signed.recentBlockhash ===
                    prepared.transaction.recentBlockhash &&
                  signed.signatures.length === 1 &&
                  signed.signatures[0].publicKey.equals(owner) &&
                  actual.length === original.length &&
                  actual.every((ix, i) => {
                    const expected = original[i];
                    return (
                      ix.programId.equals(expected.programId) &&
                      ix.data.equals(expected.data) &&
                      ix.keys.length === expected.keys.length &&
                      ix.keys.every((key, j) => {
                        const wanted = expected.keys[j];
                        return (
                          key.pubkey.equals(wanted.pubkey) &&
                          key.isSigner === wanted.isSigner &&
                          (
                            key.isWritable === wanted.isWritable ||
                            (
                              key.pubkey.equals(owner) &&
                              wanted.isWritable === false &&
                              key.isWritable === true
                            )
                          )
                        );
                      })
                    );
                  });

                if (!samePayment) {
                  const differences: string[] = [];

                  if (signed.feePayer?.equals(owner) !== true) {
                    differences.push("signed-payer");
                  }

                  if (prepared.transaction.feePayer?.equals(owner) !== true) {
                    differences.push("original-payer");
                  }

                  if (
                    signed.recentBlockhash !==
                    prepared.transaction.recentBlockhash
                  ) {
                    differences.push("blockhash");
                  }

                  if (
                    signed.signatures.length !== 1 ||
                    signed.signatures[0]?.publicKey.equals(owner) !== true
                  ) {
                    differences.push("signers");
                  }

                  if (actual.length !== original.length) {
                    differences.push(
                      "instruction-count:" +
                      actual.length + "/" + original.length
                    );
                  } else {
                    actual.forEach((ix, i) => {
                      const expected = original[i];

                      if (!ix.programId.equals(expected.programId)) {
                        differences.push("program-" + i);
                      }

                      if (!ix.data.equals(expected.data)) {
                        differences.push("data-" + i);
                      }

                      if (
                        ix.keys.length !== expected.keys.length ||
                        !ix.keys.every((key, j) => {
                          const wanted = expected.keys[j];
                          return (
                            key.pubkey.equals(wanted.pubkey) &&
                            key.isSigner === wanted.isSigner &&
                            (
                            key.isWritable === wanted.isWritable ||
                            (
                              key.pubkey.equals(owner) &&
                              wanted.isWritable === false &&
                              key.isWritable === true
                            )
                          )
                          );
                        })
                      ) {
                        differences.push("accounts-" + i);
                      }
                    });
                  }

                  throw new Error(
                    "Payment safely blocked. Differences: " +
                    (differences.join(", ") || "unknown") +
                    ". Budget instructions: " +
                    budgetInstructions.length
                  );
                }

                if (!signed.verifySignatures()) {
                  throw new Error("Invalid wallet signature.");
                }

                // Never broadcast or persist a signature that has already expired.
                if (!signed.recentBlockhash ||
                    !(await prepared.connection.isBlockhashValid(
                      signed.recentBlockhash, { commitment: "confirmed" }
                    )).value) {
                  throw new Error(
                    "Phantom approval took too long: blockhash expired. " +
                    "Nothing was broadcast. Please approve the next attempt promptly."
                  );
                }

                const rawTransaction = signed.serialize();

                // Persist before broadcasting so a timeout cannot
                // silently create a new payment attempt.
                await AsyncStorage.setItem(
                  pendingKey,
                  JSON.stringify({
                    reference: request.reference,
                    recipient: request.recipient,
                    amount: request.amount,
                    createdAt: Date.now(),
                    signedTransaction: rawTransaction.toString("base64"),
                    status: "signed",
                  })
                );

                const signature =
                  await prepared.connection.sendRawTransaction(
                    rawTransaction,
                    {
                      skipPreflight: false,
                      preflightCommitment: "confirmed",
                      minContextSlot: prepared.minContextSlot,
                      maxRetries: 3,
                    }
                  );

                await AsyncStorage.setItem(
                  pendingKey,
                  JSON.stringify({
                    reference: request.reference,
                    recipient: request.recipient,
                    amount: request.amount,
                    createdAt: Date.now(),
                    signature,
                    status: "submitted",
                  })
                );

                const latestBlockhash = freshBlockhash;

                const confirmation = await prepared.connection.confirmTransaction(
                  { signature, ...latestBlockhash },
                  "confirmed"
                );

                if (confirmation.value.err) {
                  throw new Error("Devnet transaction failed.");
                }

                const verified = await verifyPaymentSignature(signature, {
                  recipient: request.recipient,
                  reference: request.reference,
                  amount: request.amount,
                  token: request.token,
                  network: request.network,
                });

                if (!verified) {
                  throw new Error("Transaction submitted, but payment verification is incomplete.");
                }

                await AsyncStorage.setItem(
                  pendingKey,
                  JSON.stringify({
                    reference: request.reference,
                    recipient: request.recipient,
                    amount: request.amount,
                    signature,
                    status: "verified",
                    verifiedAt: Date.now(),
                  })
                );
                Alert.alert(
                  "Payment verified",
                  `Devnet test USDC payment confirmed.\n${signature}`
                );
              } catch (error) {
                Alert.alert(
                  "Payment not verified",
                  error instanceof Error ? error.message : "Unknown payment error."
                );
              } finally {
                devnetPaymentLock.current = false;
                setSendingDevnet(null);
              }
            },
          },
        ],
        {
          cancelable: false,
        }
      );
    } catch (error) {
      Alert.alert(
        "Could not prepare payment",
        error instanceof Error ? error.message : "Payment preparation failed."
      );
    } finally {
      if (!handedToConfirmation) {
        devnetPaymentLock.current = false;
        setSendingDevnet(null);
      }
    }
  }
  async function copyPaymentRequest(person: string) {
    const request = await paymentRequestFor(person);
    if (!request) return;

    try {
      await Clipboard.setStringAsync(request.url);
      Alert.alert("Payment request copied", `${person}: ${request.amount} ${paymentToken}`);
    } catch {
      Alert.alert("Copy failed", "Could not copy the payment request.");
    }
  }

  async function sharePaymentRequest(person: string) {
    const request = await paymentRequestFor(person);
    if (!request) return;

    try {
      await Share.share({
        message: `${person} owes ${request.amount} ${paymentToken}` + "\n" + request.url,
      });
    } catch {
      Alert.alert("Sharing failed", "Could not open the share menu.");
    }
  }

  async function openPaymentRequest(person: string) {
    const request = await paymentRequestFor(person);
    if (!request) return;

    const openWallet = async () => {
      try {
        await Linking.openURL(request.url);
      } catch {
        Alert.alert(
          "No compatible wallet",
          "Install a wallet that supports Solana Pay, or share the request with the payer."
        );
      }
    };

    if (request.token === "SKR") {
      Alert.alert(
        "SKR uses Solana Mainnet",
        "Turn off Phantom Testnet Mode and make sure the payer wallet is on Solana Mainnet before continuing.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Continue",
            onPress: () => {
              void openWallet();
            },
          },
        ]
      );
      return;
    }

    await openWallet();
  }
  const unassignedCount = mode === "items"
    ? items.filter((_, index) => (assignments[index]?.length ?? 0) === 0).length
    : 0;

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF8F0" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>STEP 2 OF 3</Text>
        <Text style={styles.title}>Review receipt</Text>
        <Text style={styles.description}>
          Check items, add people and choose how to split the bill.
        </Text>

        <Surface style={styles.card} elevation={0}>
          <Text style={styles.cardTitle}>Receipt items</Text>
          {items.length === 0 ? (
            <Text style={styles.muted}>No items yet. Add an expense to continue.</Text>
          ) : (
            <>
              {items.map((item, index) => (
                <View key={index} style={styles.row}>
                  <Text style={styles.white}>{item.name}</Text>
                  <Text style={styles.white}>{item.price.toFixed(2)}</Text>
                </View>
              ))}
              <Text style={styles.total}>Total: {(totalCents / 100).toFixed(2)} USDC</Text>
            </>
          )}
        </Surface>

        <Button
          mode="contained"
          buttonColor="#EA6A20"
          style={styles.button}
          onPress={() => navigation.navigate("Home")}
        >
          Add another item
        </Button>

        <Surface style={styles.card} elevation={0}>
          <Text style={styles.cardTitle}>People</Text>
          <TextInput
            label="Person's name"
            value={personName}
            onChangeText={setPersonName}
            mode="outlined"
            style={{ marginTop: 14 }}
          />
          <Button mode="contained" onPress={addPerson} style={{ marginTop: 12 }}>
            Add person
          </Button>
          {people.map((person) => (
            <View key={person} style={styles.row}>
              <Text style={styles.white}>{person}</Text>
              <Button compact onPress={() => removePerson(person)}>
                Remove
              </Button>
            </View>
          ))}
        </Surface>

        {items.length > 0 && people.length > 0 && (
          <Surface style={styles.card} elevation={0}>
            <Text style={styles.cardTitle}>Split method</Text>
            <View style={styles.choices}>
              <Chip selected={mode === "equal"} onPress={() => setMode("equal")}>
                Equally
              </Chip>
              <Chip selected={mode === "items"} onPress={() => setMode("items")}>
                By item
              </Chip>
            </View>

            {mode === "items" && items.map((item, index) => (
              <View key={index} style={styles.assignment}>
                <Text style={styles.white}>
                  {item.name} - {item.price.toFixed(2)}
                </Text>
                <View style={styles.choices}>
                  {people.map((person) => (
                    <Chip
                      key={person}
                      selected={(assignments[index] ?? []).includes(person)}
                      onPress={() => toggleAssignment(index, person)}
                    >
                      {person}
                    </Chip>
                  ))}
                </View>
              </View>
            ))}

            {unassignedCount > 0 && (
              <Text style={styles.notice}>
                Assign {unassignedCount} remaining item(s) to continue.
              </Text>
            )}

            <Text style={[styles.cardTitle, { marginTop: 20 }]}>Bill shares (USDC reference)</Text>
            {people.map((person) => (
              <View key={person} style={styles.row}>
                <Text style={styles.white}>{person}</Text>
                <Text style={styles.white}>
                  {(amountFor(person) / 100).toFixed(2)} USDC
                </Text>
              </View>
            ))}

            {unassignedCount === 0 && (
              <View style={{ marginTop: 24 }}>
                <Text style={styles.cardTitle}>Request payment</Text>
                <View style={styles.choices}>
                  <Chip selected={paymentNetwork === "mainnet"} onPress={() => setPaymentNetwork("mainnet")}>Mainnet</Chip>
                  <Chip selected={paymentNetwork === "devnet"} onPress={() => { setPaymentNetwork("devnet"); setPaymentToken("USDC"); }}>Devnet demo</Chip>
                </View>
                <Text style={styles.notice}>
                  {paymentNetwork === "devnet"
                    ? "DEVNET TEST PAYMENT: test USDC has no monetary value. Set your payer wallet to Solana Devnet before opening."
                    : "MAINNET PAYMENT: real USDC or SKR. Set your payer wallet to Solana Mainnet before opening."}
                </Text>

                <Text style={[styles.muted, { marginTop: 8 }]}>
                  Request currency
                </Text>

                <View style={styles.choices}>
                  <Chip
                    selected={paymentToken === "USDC"}
                    onPress={() => setPaymentToken("USDC")}
                  >
                    USDC
                  </Chip>
                  <Chip
                    disabled={paymentNetwork === "devnet"}
                    selected={paymentToken === "SKR"}
                    onPress={() => { setPaymentNetwork("mainnet"); setPaymentToken("SKR"); }}
                  >
                    SKR
                  </Chip>
                </View>

                <Text style={[styles.muted, { marginTop: 8 }]}>
                  Enter the wallet that should receive the {paymentToken}.
                </Text>

                {paymentToken === "SKR" && (
                  <Text style={[styles.notice, { marginTop: 8 }]}>
                    Enter the agreed SKR per 1 USDC rate. This is a manual rate, not a live market quote.
                  </Text>
                )}

                {paymentToken === "SKR" && <TextInput mode="outlined" label="SKR per 1 USDC (agreed rate)" value={skrRate} onChangeText={setSkrRate} keyboardType="decimal-pad" style={{ marginTop: 12 }} />}
                <TextInput
                  label="Recipient Solana wallet address"
                  value={recipientAddress}
                  onChangeText={setRecipientAddress}
                  autoCapitalize="none"
                  autoCorrect={false}
                  mode="outlined"
                  style={{ marginTop: 12 }}
                />
                {people.map((person) => (
                  <View key={person} style={{ marginTop: 12 }}>
                    <Button mode="text" onPress={async () => { const r = await paymentRequestFor(person); if (r) setPreview(`${person}: ${r.amount} ${paymentToken}\n${r.url}`); }}>Preview amount and link</Button>
                    <Button
                      mode="contained"
                      disabled={amountFor(person) <= 0}
                      onPress={() => sharePaymentRequest(person)}
                    >
                      Share {person}'s {paymentToken} request
                    </Button>
                    <Button
                      mode="outlined"
                      disabled={amountFor(person) <= 0}
                      onPress={() => openPaymentRequest(person)}
                      style={{ marginTop: 8 }}
                    >
                      Open in wallet
                    </Button>
                    {paymentNetwork === "devnet" && paymentToken === "USDC" && (
                      <Button
                        mode="contained"
                        buttonColor="#512DA8"
                        disabled={amountFor(person) <= 0 || sendingDevnet !== null}
                        loading={sendingDevnet === person}
                        onPress={() => void payWithPhantom(person)}
                        style={{ marginTop: 8 }}
                      >
                        Pay with Phantom - Devnet USDC
                      </Button>
                    )}
                    <Button
                      mode="text"
                      disabled={amountFor(person) <= 0}
                      onPress={() => copyPaymentRequest(person)}
                      style={{ marginTop: 4 }}
                    >
                      Copy request link
                    </Button>
                    <Button
                      mode="outlined"
                      loading={checkingPerson === person}
                      disabled={!reviewLoaded || checkingPerson !== null || amountFor(person) <= 0}
                      onPress={() => checkPayment(person)}
                      style={{ marginTop: 8 }}
                    >
                      Check payment
                    </Button>
                    <Text style={styles.muted}>
                      If reference lookup finds nothing, verify a transaction signature.
                      This checks the transfer; you assign it to {person}.
                    </Text>
                    <TextInput
                      label="Transaction signature"
                      value={signatureInputs[person] ?? ""}
                      onChangeText={value => setSignatureInputs(current => ({
                        ...current, [person]: value
                      }))}
                      autoCapitalize="none"
                      autoCorrect={false}
                      multiline
                      mode="outlined"
                      style={{ marginTop: 8 }}
                    />
                    <Button
                      mode="outlined"
                      disabled={!reviewLoaded || checkingPerson !== null || amountFor(person) <= 0}
                      onPress={() => checkSignature(person)}
                      style={{ marginTop: 8 }}
                    >
                      Verify signature for {person}
                    </Button>
                    {displayedPaymentResult(person) && (
                      <Text selectable style={styles.muted}>
                        {displayedPaymentResult(person)?.message}
                        {displayedPaymentResult(person)?.signature
                          ? "\nTransaction: " + displayedPaymentResult(person)?.signature
                          : ""}
                      </Text>
                    )}
                  </View>
                ))}
                {preview && <Text selectable style={styles.muted}>{preview}</Text>}
                <Text style={styles.muted}>
                  Copying a request does not confirm or send a payment.
                </Text>
              </View>
            )}
          </Surface>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FFF8F0" },
  content: { padding: 20, paddingBottom: 48 },
  eyebrow: {
    color: "#B94A13", fontSize: 12, fontWeight: "700",
    letterSpacing: 1, marginTop: 16,
  },
  title: { color: "#231C16", fontSize: 30, fontWeight: "800", marginTop: 8 },
  description: { color: "#65594E", fontSize: 14, lineHeight: 21, marginTop: 8 },
  card: {
    backgroundColor: "#FFFFFF", borderColor: "#EADCCC",
    borderRadius: 20, borderWidth: 1, marginTop: 24, padding: 18,
  },
  cardTitle: { color: "#231C16", fontSize: 18, fontWeight: "700" },
  muted: { color: "#65594E", fontSize: 14, marginTop: 12 },
  white: { color: "#231C16", fontSize: 14 },
  total: { color: "#B94A13", fontWeight: "700", marginTop: 18 },
  notice: { color: "#A33F0E", marginTop: 14 },
  row: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginTop: 14,
  },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  assignment: {
    borderTopWidth: 1, borderTopColor: "#EADCCC",
    marginTop: 16, paddingTop: 14,
  },
  button: { borderRadius: 14, marginTop: 20 },
});
