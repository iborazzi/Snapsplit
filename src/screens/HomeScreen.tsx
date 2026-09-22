import React from "react";
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
} from "react-native";
import {
  Button,
  Card,
  Chip,
  Surface,
  Text,
} from "react-native-paper";

import { AccountDetailFeature } from "../components/account/account-detail-feature";
import { SignInFeature } from "../components/sign-in/sign-in-feature";
import { useAuthorization } from "../utils/useAuthorization";

export function HomeScreen() {
  const { selectedAccount } = useAuthorization();

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
            SOL or USDC.
          </Text>

          <Button
            mode="contained"
            icon="camera"
            buttonColor="#7C5CFC"
            textColor="#FFFFFF"
            contentStyle={styles.primaryButtonContent}
            style={styles.primaryButton}
            onPress={() => {}}
          >
            Scan a receipt
          </Button>

          <Button
            mode="outlined"
            icon="plus"
            textColor="#D0D5DD"
            style={styles.secondaryButton}
            onPress={() => {}}
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
            description="Create an instant SOL or USDC payment request."
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
  },
  footer: {
    color: "#475467",
    fontSize: 11,
    marginTop: 32,
    textAlign: "center",
  },
});
