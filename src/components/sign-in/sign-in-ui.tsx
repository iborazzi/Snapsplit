import { useState, useCallback } from "react";
import { Button } from "react-native-paper";
import { alertAndLog } from "../../utils/alertAndLog";
import { useMobileWallet } from "../../utils/useMobileWallet";

export function ConnectButton() {
  const { connect } = useMobileWallet();
  const [authorizationInProgress, setAuthorizationInProgress] = useState(false);
  const handleConnectPress = useCallback(async () => {
    try {
      if (authorizationInProgress) {
        return;
      }
      setAuthorizationInProgress(true);
      await connect();
    } catch (err: any) {
      alertAndLog(
        "Error during connect",
        err instanceof Error ? err.message : err
      );
    } finally {
      setAuthorizationInProgress(false);
    }
  }, [authorizationInProgress, connect]);
  return (
    <Button
      mode="contained"
      disabled={authorizationInProgress}
      onPress={handleConnectPress}
      style={{ flex: 1 }}
    >
      Connect
    </Button>
  );
}

export function SignInButton() {
  const { signIn } = useMobileWallet();
  const [signInInProgress, setSignInInProgress] = useState(false);
  const handleConnectPress = useCallback(async () => {
    try {
      if (signInInProgress) {
        return;
      }
      setSignInInProgress(true);
      await signIn({
        domain: "github.com",
        statement: "Sign in to SnapSplit",
        uri: "https://github.com/iborazzi/Snapsplit",
      });
    } catch (err: any) {
      alertAndLog(
        "Error during sign in",
        err instanceof Error ? err.message : err
      );
    } finally {
      setSignInInProgress(false);
    }
  }, [signInInProgress, signIn]);
  return (
    <Button
      mode="outlined"
      disabled={signInInProgress}
      onPress={handleConnectPress}
      style={{ marginLeft: 4, flex: 1 }}
    >
      Sign in
    </Button>
  );
}
