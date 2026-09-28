import React, { useEffect, useState } from "react";
import {
  Alert,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { extractTextFromImage, isSupported } from "expo-text-extractor";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Button,
  Card,
  Chip,
  Modal,
  Portal,
  Surface,
  Text,
  TextInput,
} from "react-native-paper";
import { useNavigation } from "@react-navigation/native";
import { AccountDetailFeature } from "../components/account/account-detail-feature";
import { SignInFeature } from "../components/sign-in/sign-in-feature";
import { useAuthorization } from "../utils/useAuthorization";

export function HomeScreen() {
  const { selectedAccount } = useAuthorization();
  const navigation = useNavigation<any>();
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const [ocrLines, setOcrLines] = useState<string[]>([]);
  const [ocrDrafts, setOcrDrafts] = useState<{ name: string; price: string }[]>([]);
  const [ocrIsUsdc, setOcrIsUsdc] = useState(false);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [receiptReady, setReceiptReady] = useState(false);
  const [manualVisible, setManualVisible] = useState(false);
  const [itemName, setItemName] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [items, setItems] = useState<{ name: string; price: number }[]>([]);
  const [itemsLoaded, setItemsLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem("snapsplit-items")
      .then((saved) => {
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) setItems(parsed);
        }
      })
      .catch((error) => console.warn("Could not load items", error))
      .finally(() => setItemsLoaded(true));
  }, []);

  useEffect(() => {
    if (itemsLoaded) {
      AsyncStorage.setItem("snapsplit-items", JSON.stringify(items))
        .catch((error) => console.warn("Could not save items", error));
    }
  }, [items, itemsLoaded]);

  function addManualItem() {
    const name = itemName.trim();
    const price = Number(itemPrice.replace(",", "."));

    if (!name || !Number.isFinite(price) || price <= 0) {
      Alert.alert("Check item", "Enter an item name and a price above zero.");
      return;
    }

    const updatedItems = [...items, { name, price }];
    setItems(updatedItems);
    setItemName("");
    setItemPrice("");
    setManualVisible(false);
    navigation.navigate("Split", { items: updatedItems, receiptUri });
  }
  function parseReceiptLines(lines: string[]) {
    const ignore = /^(?:SNAPSPLIT|CURRENCY|TOTAL|SUBTOTAL|TAX|VAT|KDV|DATE|TARIH)/i;
    const names: string[] = [];
    const prices: string[] = [];
    const inline: { name: string; price: string }[] = [];

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || ignore.test(line)) continue;

      const combined = line.match(/^(.+?)\s+(\d+[.,]\d{2})$/);
      if (combined && /[A-Za-z]/.test(combined[1])) {
        inline.push({
          name: combined[1].trim(),
          price: combined[2].replace(",", "."),
        });
        continue;
      }

      if (/^\d+[.,]\d{2}$/.test(line)) {
        prices.push(line.replace(",", "."));
      } else if (/[A-Za-z]/.test(line) && !/^[-\s]+$/.test(line)) {
        names.push(line);
      }
    }

    if (inline.length > 0) return inline;
    return names.slice(0, prices.length).map((name, index) => ({
      name,
      price: prices[index],
    }));
  }

  function updateOcrDraft(
    index: number,
    field: "name" | "price",
    value: string
  ) {
    setOcrDrafts((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      )
    );
  }

  function useDetectedItems() {
    if (!ocrIsUsdc) {
      Alert.alert(
        "Currency needs review",
        "Automatic USDC payment requests require a receipt priced in USDC."
      );
      return;
    }

    const detected = ocrDrafts.map((item) => ({
      name: item.name.trim(),
      price: Number(item.price.replace(",", ".")),
    }));

    if (
      detected.length === 0 ||
      detected.some(
        (item) =>
          !item.name ||
          !Number.isFinite(item.price) ||
          item.price <= 0
      )
    ) {
      Alert.alert("Check detected items", "Correct every item name and price.");
      return;
    }

    setItems(detected);
    setReceiptReady(true);
    navigation.navigate("Split", { receiptUri, items: detected, resetSplit: true });
  }
  async function recognizeReceipt(uri: string) {
    setReceiptUri(uri);
    setReceiptReady(false);
    setOcrLines([]);
    setOcrDrafts([]);
    setOcrIsUsdc(false);
    setOcrBusy(true);

    try {
      if (!isSupported) {
        Alert.alert("OCR unavailable", "Text recognition is not supported here.");
        return;
      }
      const lines = await extractTextFromImage(uri);
      setOcrLines(lines);
      setOcrDrafts(parseReceiptLines(lines));
      setOcrIsUsdc(/\bUSDC\b/i.test(lines.join(" ")));

      if (lines.length === 0) {
        Alert.alert("No text found", "Try a clearer photo or add items manually.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown OCR error";
      Alert.alert("Text recognition failed", message);
    } finally {
      setOcrBusy(false);
    }
  }

  async function chooseReceiptPhoto() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.9,
      });
      if (!result.canceled && result.assets.length > 0) {
        await recognizeReceipt(result.assets[0].uri);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown image error";
      Alert.alert("Could not open gallery", message);
    }
  }
  async function scanReceipt() {
  try {
    const permission = await ImagePicker.getCameraPermissionsAsync();

    if (!permission.granted) {
      const requestedPermission =
        await ImagePicker.requestCameraPermissionsAsync();

      if (!requestedPermission.granted) {
        Alert.alert(
          "Camera permission required",
          "SnapSplit needs camera access to scan your receipt.",
        );
        return;
      }
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 0.7,
    });

    if (result.canceled) {
      Alert.alert("Camera closed", "No receipt photo was captured.");
      return;
    }

    if (result.assets.length > 0) {
      await recognizeReceipt(result.assets[0].uri);
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown camera error";

    Alert.alert("Camera error", message);
  }
}

 
  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor="#101828" />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>SnapSplit</Text>
            <Text style={styles.tagline}>
              Snap the receipt. Split the bill. Settle on Solana.
            </Text>
          </View>

          <Chip
            compact
            icon={selectedAccount ? "check-circle" : "wallet-outline"}
            style={[
              styles.walletChip,
              selectedAccount && styles.connectedChip,
            ]}
            textStyle={styles.walletChipText}
          >
            {selectedAccount ? "Connected" : "Not connected"}
          </Chip>
        </View>

        <Surface style={styles.heroCard} elevation={0}>
          <View style={styles.heroIcon}>
            <Text style={styles.heroEmoji}>🧾</Text>
          </View>

          <Text style={styles.heroTitle}>Split any receipt in seconds</Text>

          <Text style={styles.heroDescription}>
            Take a photo, assign items to friends and settle instantly using
            USDC on Solana.
          </Text>

          <Button
            mode="contained"
            icon="camera"
            buttonColor="#7C5CFC"
            textColor="#FFFFFF"
            contentStyle={styles.primaryButtonContent}
            style={styles.primaryButton}
            onPress={scanReceipt}
          >
            Scan a receipt
          </Button>
          <Button
            mode="text"
            onPress={chooseReceiptPhoto}
            textColor="#A78BFA"
          >
            Choose receipt photo from gallery
          </Button>

          {ocrBusy && (
            <Text style={{ color: "#FFFFFF", marginTop: 12 }}>
              Reading receipt text...
            </Text>
          )}

          {ocrLines.length > 0 && (
            <View style={{ marginTop: 16, padding: 14, backgroundColor: "#344054", borderRadius: 12 }}>
              <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>
                Recognized receipt text
              </Text>
              {ocrLines.map((line, index) => (
                <Text key={index} style={{ color: "#D0D5DD", marginTop: 5 }}>
                  {line}
                </Text>
              ))}
            </View>
          )}

          {ocrDrafts.length > 0 && (
            <View style={{ marginTop: 16, padding: 14, backgroundColor: "#344054", borderRadius: 12 }}>
              <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 17 }}>
                Check detected items
              </Text>
              {ocrDrafts.map((item, index) => (
                <View key={index} style={{ marginTop: 12, gap: 8 }}>
                  <TextInput
                    label={`Item ${index + 1}`}
                    value={item.name}
                    onChangeText={(value) => updateOcrDraft(index, "name", value)}
                    mode="outlined"
                  />
                  <TextInput
                    label="Price (USDC)"
                    value={item.price}
                    onChangeText={(value) => updateOcrDraft(index, "price", value)}
                    keyboardType="decimal-pad"
                    mode="outlined"
                  />
                </View>
              ))}
              {!ocrIsUsdc && (
                <Text style={{ color: "#FDB022", marginTop: 12 }}>
                  Receipt currency is not USDC. Review it before creating a USDC payment request.
                </Text>
              )}
              <Button
                mode="contained"
                disabled={!ocrIsUsdc}
                onPress={useDetectedItems}
                style={{ marginTop: 16 }}
              >
                Use checked items
              </Button>
            </View>
          )}
          {receiptUri && (
            <View style={styles.previewContainer}>
              <Image
                source={{ uri: receiptUri }}
                style={styles.receiptImage}
              />

              <View style={styles.previewActions}>
                <Button
                  mode="outlined"
                  textColor="#D0D5DD"
                  style={styles.previewButton}
                  onPress={scanReceipt}
                >
                  Retake
                </Button>

                <Button
                  mode="contained"
                  buttonColor="#12B76A"
                  textColor="#FFFFFF"
                  style={styles.previewButton}
                  onPress={() => {
                    if (ocrDrafts.length === 0 || !ocrIsUsdc) {
                        Alert.alert(
                          "Review receipt first",
                          "Recognize and check the receipt items before continuing."
                        );
                        return;
                      }
                      useDetectedItems();
                  }}
                >
                  {receiptReady ? "Receipt selected ✓" : "Use receipt"}
                </Button>
              </View>
            </View>
          )}
          <Button
            mode="outlined"
            icon="plus"
            textColor="#D0D5DD"
            style={styles.secondaryButton}
            onPress={() => setManualVisible(true)}
          >
            Add expense manually
          </Button>
        </Surface>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>How it works</Text>
          <Text style={styles.stepCounter}>3 simple steps</Text>
        </View>

        <View style={styles.steps}>
          <StepCard
            number="01"
            title="Scan"
            description="Capture a restaurant or shopping receipt."
          />
          <StepCard
            number="02"
            title="Split"
            description="Assign each item or divide the total equally."
          />
          <StepCard
            number="03"
            title="Settle"
            description="Create an instant USDC on Solana payment request."
          />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent split</Text>
          <Text style={styles.linkText}>View all</Text>
        </View>

        <Card mode="contained" style={styles.recentCard}>
          <Card.Content style={styles.recentContent}>
            <View style={styles.receiptBadge}>
              <Text style={styles.receiptEmoji}>🍕</Text>
            </View>

            <View style={styles.recentInfo}>
              <Text style={styles.recentTitle}>Friday Dinner</Text>
              <Text style={styles.recentMeta}>4 people · Demo split</Text>
            </View>

            <View style={styles.amountArea}>
              <Text style={styles.amount}>48 USDC</Text>
              <Text style={styles.pending}>Pending</Text>
            </View>
          </Card.Content>
        </Card>

        <View style={styles.walletSection}>
          <Text style={styles.sectionTitle}>Solana wallet</Text>

          {selectedAccount ? (
            <View style={styles.accountContainer}>
              <AccountDetailFeature />
            </View>
          ) : (
            <View style={styles.signInContainer}>
              <Text style={styles.walletDescription}>
                Connect your wallet to send and receive split payments.
              </Text>
              <SignInFeature />
            </View>
          )}
        </View>

        <Text style={styles.footer}>
          Built for Solana Mobile · Clock In Hackathon
        </Text>
      </ScrollView>

      <Portal>
        <Modal
          visible={manualVisible}
          onDismiss={() => setManualVisible(false)}
          contentContainerStyle={{
            margin: 24,
            padding: 20,
            borderRadius: 18,
            backgroundColor: "#1D2939",
            gap: 12,
          }}
        >
          <Text style={{ color: "#FFFFFF", fontSize: 20, fontWeight: "700" }}>
            Add an expense
          </Text>
          <TextInput
            label="Item name"
            value={itemName}
            onChangeText={setItemName}
            mode="outlined"
          />
          <TextInput
            label="Price (USDC)"
            value={itemPrice}
            onChangeText={setItemPrice}
            keyboardType="decimal-pad"
            mode="outlined"
          />
          <Button mode="contained" onPress={addManualItem}>
            Add item
          </Button>
        </Modal>
      </Portal>
    </View>
  );
}

type StepCardProps = {
  number: string;
  title: string;
  description: string;
};

function StepCard({ number, title, description }: StepCardProps) {
  return (
    <Surface style={styles.stepCard} elevation={0}>
      <Text style={styles.stepNumber}>{number}</Text>
      <Text style={styles.stepTitle}>{title}</Text>
      <Text style={styles.stepDescription}>{description}</Text>
    </Surface>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#101828",
  },
  content: {
    padding: 20,
    paddingBottom: 48,
  },
  header: {
    gap: 14,
    marginBottom: 24,
  },
  brand: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: -1,
  },
  tagline: {
    color: "#98A2B3",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  walletChip: {
    alignSelf: "flex-start",
    backgroundColor: "#344054",
  },
  connectedChip: {
    backgroundColor: "#14532D",
  },
  walletChipText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  heroCard: {
    backgroundColor: "#1D2939",
    borderColor: "#344054",
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
  },
  heroIcon: {
    alignItems: "center",
    backgroundColor: "#2D234F",
    borderRadius: 18,
    height: 64,
    justifyContent: "center",
    marginBottom: 18,
    width: 64,
  },
  heroEmoji: {
    fontSize: 32,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 25,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  heroDescription: {
    color: "#98A2B3",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 22,
    marginTop: 8,
  },
  primaryButton: {
    borderRadius: 14,
    marginBottom: 10,
  },
  primaryButtonContent: {
    height: 52,
  },
  secondaryButton: {
    borderColor: "#475467",
    borderRadius: 14,
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
    marginTop: 28,
  },
  sectionTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
  },
  stepCounter: {
    color: "#667085",
    fontSize: 12,
  },
  steps: {
    gap: 10,
  },
  stepCard: {
    backgroundColor: "#1D2939",
    borderRadius: 16,
    flexDirection: "row",
    gap: 12,
    padding: 16,
  },
  stepNumber: {
    color: "#A48AFB",
    fontSize: 13,
    fontWeight: "900",
  },
  stepTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
    width: 48,
  },
  stepDescription: {
    color: "#98A2B3",
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  linkText: {
    color: "#A48AFB",
    fontSize: 13,
    fontWeight: "700",
  },
  recentCard: {
    backgroundColor: "#1D2939",
    borderRadius: 18,
  },
  recentContent: {
    alignItems: "center",
    flexDirection: "row",
    paddingVertical: 16,
  },
  receiptBadge: {
    alignItems: "center",
    backgroundColor: "#344054",
    borderRadius: 14,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  receiptEmoji: {
    fontSize: 22,
  },
  recentInfo: {
    flex: 1,
    marginLeft: 12,
  },
  recentTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  recentMeta: {
    color: "#667085",
    fontSize: 12,
    marginTop: 3,
  },
  amountArea: {
    alignItems: "flex-end",
  },
  amount: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  pending: {
    color: "#FDB022",
    fontSize: 11,
    marginTop: 3,
  },
  walletSection: {
    marginTop: 28,
  },
  signInContainer: {
    backgroundColor: "#1D2939",
    borderRadius: 18,
    marginTop: 12,
    padding: 16,
  },
  walletDescription: {
    color: "#98A2B3",
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  accountContainer: {
    backgroundColor: "#1D2939",
    borderRadius: 18,
    marginTop: 12,
    overflow: "hidden",
    padding: 8,
  },  previewContainer: {
    marginBottom: 12,
    marginTop: 14,
  },
  receiptImage: {
    borderRadius: 16,
    height: 220,
    resizeMode: "cover",
    width: "100%",
  },
  previewActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  previewButton: {
    borderRadius: 12,
    flex: 1,
  },
  footer: {
    color: "#475467",
    fontSize: 11,
    marginTop: 32,
    textAlign: "center",
  },
});
