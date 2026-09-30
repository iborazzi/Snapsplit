import { requestUri, settlementAmounts } from "../domain/settlement";
import React, { useEffect, useState } from "react";
import { Alert, Linking, ScrollView, Share, StatusBar, StyleSheet, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { PublicKey } from "@solana/web3.js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Button, Chip, Surface, Text, TextInput } from "react-native-paper";
import { useNavigation, useRoute } from "@react-navigation/native";

type ReceiptItem = { name: string; price: number };
type SplitMode = "equal" | "items";

export function ReceiptReviewScreen() {
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
      JSON.stringify({ people, mode, assignments, recipientAddress })
    ).catch((error) => console.warn("Could not save split", error));
  }, [people, mode, assignments, recipientAddress, reviewLoaded, route.params?.resetSplit]);

  useEffect(() => {
    if (!reviewLoaded || !route.params?.resetSplit) return;

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

  function paymentRequestFor(person: string): { url: string; amount: string } | null {
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
      const url = requestUri(address, paymentToken, amount, person, paymentNetwork);
      return { url, amount };
    } catch (error) { Alert.alert("Check settlement rate", error instanceof Error ? error.message : "Invalid settlement."); return null; }


  }

  async function copyPaymentRequest(person: string) {
    const request = paymentRequestFor(person);
    if (!request) return;

    try {
      await Clipboard.setStringAsync(request.url);
      Alert.alert("Payment request copied", `${person}: ${request.amount} ${paymentToken}`);
    } catch {
      Alert.alert("Copy failed", "Could not copy the payment request.");
    }
  }

  async function sharePaymentRequest(person: string) {
    const request = paymentRequestFor(person);
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
    const request = paymentRequestFor(person);
    if (!request) return;

    try {
      await Linking.openURL(request.url);
    } catch {
      Alert.alert(
        "No compatible wallet",
        "Install a wallet that supports Solana Pay, or share the request with the payer."
      );
    }
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
                    onPress={() => setPaymentToken("SKR")}
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
                    <Button mode="text" onPress={() => { const r = paymentRequestFor(person); if (r) setPreview(`${person}: ${r.amount} ${paymentToken}\n${r.url}`); }}>Preview amount and link</Button>
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
                    <Button
                      mode="text"
                      disabled={amountFor(person) <= 0}
                      onPress={() => copyPaymentRequest(person)}
                      style={{ marginTop: 4 }}
                    >
                      Copy request link
                    </Button>
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



