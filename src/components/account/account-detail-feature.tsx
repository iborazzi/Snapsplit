import { View } from "react-native";
import { useAuthorization } from "../../utils/useAuthorization";
import {
  AccountBalance,
  AccountButtonGroup,
  AccountTokens,
} from "./account-ui";

export function AccountDetailFeature() {
  const { selectedAccount } = useAuthorization();

  if (!selectedAccount) {
    return null;
  }

  return (
    <>
      <View style={{ marginTop: 24, alignItems: "center" }}>
        <AccountBalance address={selectedAccount.publicKey} />
        <AccountButtonGroup address={selectedAccount.publicKey} />
      </View>
      <View style={{ marginTop: 48 }}>
        <AccountTokens address={selectedAccount.publicKey} />
      </View>
    </>
  );
}
