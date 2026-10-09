import AsyncStorage from "@react-native-async-storage/async-storage";
import { PublicKey, PublicKeyInitData } from "@solana/web3.js";
import {
  Account as AuthorizedAccount,
  AuthorizationResult,
  AuthorizeAPI,
  AuthToken,
  Base64EncodedAddress,
  DeauthorizeAPI,
  SignInPayload,
} from "@solana-mobile/mobile-wallet-adapter-protocol";
import { toUint8Array } from "js-base64";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { useCluster, ClusterNetwork } from "../components/cluster/cluster-data-access";


export type Account = Readonly<{
  address: Base64EncodedAddress;
  label?: string;
  publicKey: PublicKey;
}>;

type WalletAuthorization = Readonly<{
  chain?: string;
  accounts: Account[];
  authToken: AuthToken;
  selectedAccount: Account;
}>;

function getAccountFromAuthorizedAccount(account: AuthorizedAccount): Account {
  return {
    ...account,
    publicKey: getPublicKeyFromAddress(account.address),
  };
}

function getAuthorizationFromAuthorizationResult(
  authorizationResult: AuthorizationResult,
  previouslySelectedAccount?: Account
): WalletAuthorization {
  if (!authorizationResult.accounts.length) {
    throw new Error("Wallet returned no authorized accounts.");
  }
  let selectedAccount: Account;
  if (
    // We have yet to select an account.
    previouslySelectedAccount == null ||
    // The previously selected account is no longer in the set of authorized addresses.
    !authorizationResult.accounts.some(
      ({ address }) => address === previouslySelectedAccount.address
    )
  ) {
    const firstAccount = authorizationResult.accounts[0];
    selectedAccount = getAccountFromAuthorizedAccount(firstAccount);
  } else {
    selectedAccount = previouslySelectedAccount;
  }
  return {
    accounts: authorizationResult.accounts.map(getAccountFromAuthorizedAccount),
    authToken: authorizationResult.auth_token,
    selectedAccount,
  };
}

function getPublicKeyFromAddress(address: Base64EncodedAddress): PublicKey {
  const publicKeyByteArray = toUint8Array(address);
  return new PublicKey(publicKeyByteArray);
}

function cacheReviver(key: string, value: any) {
  if (key === "publicKey") {
    return new PublicKey(value as PublicKeyInitData); // the PublicKeyInitData should match the actual data structure stored in AsyncStorage
  } else {
    return value;
  }
}

const AUTHORIZATION_STORAGE_KEY = "authorization-cache";

async function fetchAuthorization(): Promise<WalletAuthorization | null> {
  const cacheFetchResult = await AsyncStorage.getItem(
    AUTHORIZATION_STORAGE_KEY
  );

  if (!cacheFetchResult) {
    return null;
  }

  // Return prior authorization, if found.
  return JSON.parse(cacheFetchResult, cacheReviver);
}

async function persistAuthorization(
  auth: WalletAuthorization | null
): Promise<void> {
  await AsyncStorage.setItem(AUTHORIZATION_STORAGE_KEY, JSON.stringify(auth));
}

export const APP_IDENTITY = {
  name: "SnapSplit",
  uri: "https://github.com/iborazzi/Snapsplit",
};

export function useAuthorization() {
  const { selectedCluster } = useCluster();
  const chainIdentifier = selectedCluster.network === ClusterNetwork.Mainnet
    ? "solana:mainnet"
    : selectedCluster.network === ClusterNetwork.Testnet
      ? "solana:testnet"
      : "solana:devnet";
  const queryClient = useQueryClient();
  const { data: authorization, isLoading } = useQuery({
    queryKey: ["wallet-authorization", chainIdentifier],
    queryFn: async () => {
      try {
        const saved = await fetchAuthorization();
        return saved?.chain === chainIdentifier ? saved : null;
      } catch {
        return null;
      }
    },
  });
  const { mutateAsync: setAuthorization } = useMutation({
    mutationFn: persistAuthorization,
    onSuccess: (_result, auth) => {
      queryClient.setQueryData(["wallet-authorization", chainIdentifier], auth);
    },
  });

  const handleAuthorizationResult = useCallback(
    async (
      authorizationResult: AuthorizationResult
    ): Promise<WalletAuthorization> => {
      const nextAuthorization = {
        ...getAuthorizationFromAuthorizationResult(
          authorizationResult,
          authorization?.selectedAccount
        ),
        chain: chainIdentifier,
      };
      await setAuthorization(nextAuthorization);
      return nextAuthorization;
    },
    [authorization, setAuthorization, chainIdentifier]
  );
  const authorizeSession = useCallback(
    async (wallet: AuthorizeAPI) => {
      let authorizationResult: AuthorizationResult;

      try {
        authorizationResult = await wallet.authorize({
          identity: APP_IDENTITY,
          chain: chainIdentifier,
          auth_token: authorization?.authToken,
        });
      } catch (error) {
        if (!authorization?.authToken) {
          throw error;
        }

        // Stored authorization may have expired or been revoked.
        // Request fresh consent once, without the old token.
        authorizationResult = await wallet.authorize({
          identity: APP_IDENTITY,
          chain: chainIdentifier,
        });
      }

      return (await handleAuthorizationResult(authorizationResult))
        .selectedAccount;
    },
    [authorization, handleAuthorizationResult, chainIdentifier]
  );
  const authorizeSessionWithSignIn = useCallback(
    async (wallet: AuthorizeAPI, signInPayload: SignInPayload) => {
      const authorizationResult = await wallet.authorize({
        identity: APP_IDENTITY,
        chain: chainIdentifier,
        auth_token: authorization?.authToken,
        sign_in_payload: signInPayload,
      });
      return (await handleAuthorizationResult(authorizationResult))
        .selectedAccount;
    },
    [authorization, handleAuthorizationResult, chainIdentifier]
  );
  const deauthorizeSession = useCallback(
    async (wallet: DeauthorizeAPI) => {
      if (authorization?.authToken == null) {
        return;
      }
      await wallet.deauthorize({ auth_token: authorization.authToken });
      await setAuthorization(null);
    },
    [authorization, setAuthorization]
  );
  return useMemo(
    () => ({
      accounts: authorization?.accounts ?? null,
      authorizeSession,
      authorizeSessionWithSignIn,
      deauthorizeSession,
      selectedAccount: authorization?.selectedAccount ?? null,
      isLoading,
    }),
    [authorization, authorizeSession, authorizeSessionWithSignIn, deauthorizeSession, isLoading]
  );
}
