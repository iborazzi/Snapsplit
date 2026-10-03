import {
  Connection,
  PublicKey,
  clusterApiUrl,
  type ParsedTransactionWithMeta,
} from "@solana/web3.js";
import { DEVNET_USDC, MINTS, type PaymentNetwork, type Token } from "./settlement";

export interface ExpectedPayment {
  recipient: string;
  reference: string;
  amount: string;
  token: Token;
  network: PaymentNetwork;
}

export function decimalUnits(amount: string, decimals: number): bigint {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
    throw new Error("Unsupported token precision.");
  }
  if (!/^\d+(\.\d+)?$/.test(amount)) {
    throw new Error("Invalid payment amount.");
  }
  const [whole, fraction = ""] = amount.split(".");
  if (fraction.length > decimals) {
    throw new Error("Payment amount exceeds token precision.");
  }
  const units = BigInt(whole) * 10n ** BigInt(decimals) +
    BigInt(fraction.padEnd(decimals, "0") || "0");
  if (units <= 0n) throw new Error("Payment amount must be positive.");
  return units;
}

export function matchesPayment(
  transaction: ParsedTransactionWithMeta | null,
  expected: ExpectedPayment
): boolean {
  return matchesBalances(transaction, expected, true);
}

function matchesBalances(
  transaction: ParsedTransactionWithMeta | null,
  expected: ExpectedPayment,
  requireReference: boolean
): boolean {
  if (!transaction?.meta || transaction.meta.err !== null) return false;
  if (expected.network === "devnet" && expected.token !== "USDC") return false;

  const keys = transaction.transaction.message.accountKeys;
  const reference = keys.find(key => key.pubkey.toBase58() === expected.reference);
  if (requireReference && (!reference || reference.signer || reference.writable)) {
    return false;
  }

  const mint = expected.network === "devnet" ? DEVNET_USDC : MINTS[expected.token];
  const before = transaction.meta.preTokenBalances;
  const after = transaction.meta.postTokenBalances;
  if (!before || !after) return false;

  const received = after.filter(
    balance => balance.owner === expected.recipient && balance.mint === mint
  );
  if (!received.length) return false;

  const decimals = received[0].uiTokenAmount.decimals;
  let wanted: bigint;
  try {
    wanted = decimalUnits(expected.amount, decimals);
  } catch {
    return false;
  }

  let increase = 0n;
  for (const balance of received) {
    if (balance.uiTokenAmount.decimals !== decimals) return false;
    const previous = before.find(row => row.accountIndex === balance.accountIndex);
    if (previous && (
      previous.owner !== expected.recipient ||
      previous.mint !== mint ||
      previous.uiTokenAmount.decimals !== decimals
    )) return false;
    increase += BigInt(balance.uiTokenAmount.amount) -
      BigInt(previous?.uiTokenAmount.amount ?? "0");
  }

  // Include accounts closed during the transaction in the recipient's net change.
  for (const balance of before) {
    if (balance.owner === expected.recipient && balance.mint === mint &&
        !after.some(row => row.accountIndex === balance.accountIndex)) {
      if (balance.uiTokenAmount.decimals !== decimals) return false;
      increase -= BigInt(balance.uiTokenAmount.amount);
    }
  }
  return increase === wanted;
}

export async function findPayment(expected: ExpectedPayment): Promise<string | null> {
  new PublicKey(expected.recipient);
  const reference = new PublicKey(expected.reference);
  if (expected.network === "devnet" && expected.token !== "USDC") {
    throw new Error("Devnet supports test USDC only.");
  }

  const connection = new Connection(
    clusterApiUrl(expected.network === "devnet" ? "devnet" : "mainnet-beta"),
    "finalized"
  );
  const signatures = await connection.getSignaturesForAddress(
    reference, { limit: 20 }, "finalized"
  );
  for (const entry of signatures) {
    if (entry.err) continue;
    const transaction = await connection.getParsedTransaction(entry.signature, {
      commitment: "finalized",
      maxSupportedTransactionVersion: 0,
    });
    if (matchesPayment(transaction, expected)) return entry.signature;
  }
  return null;
}


// Signature checks verify the transfer; the user assigns it to a participant.
export function matchesRecordedTransfer(
  transaction: ParsedTransactionWithMeta | null,
  expected: ExpectedPayment
): boolean {
  if (!matchesBalances(transaction, expected, false) || !transaction?.meta) {
    return false;
  }
  const mint = expected.network === "devnet" ? DEVNET_USDC : MINTS[expected.token];
  const keys = transaction.transaction.message.accountKeys;
  const balances = transaction.meta.postTokenBalances ?? [];
  const instructions = [
    ...transaction.transaction.message.instructions,
    ...(transaction.meta.innerInstructions ?? []).flatMap(group => group.instructions),
  ];

  return instructions.some(instruction => {
    if (!("parsed" in instruction) ||
        instruction.programId.toBase58() !==
          "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA") return false;
    const parsed = instruction.parsed;
    if (parsed?.type !== "transferChecked") return false;
    const info = parsed.info;
    if (!info || info.mint !== mint || !info.tokenAmount) return false;
    const destination = balances.find(balance =>
      balance.owner === expected.recipient &&
      balance.mint === mint &&
      keys[balance.accountIndex]?.pubkey.toBase58() === info.destination
    );
    if (!destination ||
        destination.uiTokenAmount.decimals !== info.tokenAmount.decimals) return false;
    try {
      return BigInt(info.tokenAmount.amount) ===
        decimalUnits(expected.amount, info.tokenAmount.decimals);
    } catch {
      return false;
    }
  });
}

export async function verifyPaymentSignature(
  signature: string,
  expected: ExpectedPayment
): Promise<boolean> {
  if (!/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(signature)) {
    throw new Error("Paste the transaction signature, not an explorer URL.");
  }
  new PublicKey(expected.recipient);
  const connection = new Connection(
    clusterApiUrl(expected.network === "devnet" ? "devnet" : "mainnet-beta"),
    "finalized"
  );
  const transaction = await connection.getParsedTransaction(signature, {
    commitment: "finalized",
    maxSupportedTransactionVersion: 0,
  });
  if (!transaction?.transaction.signatures.includes(signature)) return false;
  return matchesRecordedTransfer(transaction, expected);
}
