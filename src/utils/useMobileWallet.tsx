import { transact } from "@solana-mobile/mobile-wallet-adapter-protocol-web3js";
import { Account, useAuthorization } from "./useAuthorization";
import {
  PublicKey,
  Connection,
  Transaction,
  TransactionSignature,
  VersionedTransaction,
} from "@solana/web3.js";
import { useCallback, useMemo } from "react";
import { SignInPayload } from "@solana-mobile/mobile-wallet-adapter-protocol";

export function useMobileWallet() {
  const { authorizeSessionWithSignIn, authorizeSession, deauthorizeSession } =
    useAuthorization();

  const connect = useCallback(async (): Promise<Account> => {
    return await transact(async (wallet) => {
      return await authorizeSession(wallet);
    });
  }, [authorizeSession]);

  const signIn = useCallback(
    async (signInPayload: SignInPayload): Promise<Account> => {
      return await transact(async (wallet) => {
        return await authorizeSessionWithSignIn(wallet, signInPayload);
      });
    },
    [authorizeSessionWithSignIn]
  );

  const disconnect = useCallback(async (): Promise<void> => {
    await transact(async (wallet) => {
      await deauthorizeSession(wallet);
    });
  }, [deauthorizeSession]);

  const signAndSendTransaction = useCallback(
    async (
      transaction: Transaction | VersionedTransaction,
      minContextSlot: number,
    ): Promise<TransactionSignature> => {
      return await transact(async (wallet) => {
        await authorizeSession(wallet);
        const signatures = await wallet.signAndSendTransactions({
          transactions: [transaction],
          minContextSlot,
        });
        return signatures[0];
      });
    },
    [authorizeSession]
  );

  const signOnlyForAccount = useCallback(
    async (
      transaction: Transaction,
      expectedOwner: PublicKey,
      connection: Connection
    ): Promise<{
      signed: Transaction;
      latestBlockhash: { blockhash: string; lastValidBlockHeight: number };
    }> => {
      return await transact(async (wallet) => {
        const authorized = await authorizeSession(wallet);

        if (!authorized.publicKey.equals(expectedOwner)) {
          throw new Error("Wallet account changed. Signing cancelled.");
        }

        // Request a fresh blockhash after the permission handshake, not before it.
        const latestBlockhash = await connection.getLatestBlockhash("confirmed");
        transaction.recentBlockhash = latestBlockhash.blockhash;

        const signedTransactions = await wallet.signTransactions({
          transactions: [transaction],
        });

        const signed = signedTransactions[0];

        if (!signed || !signed.verifySignatures()) {
          throw new Error("Wallet did not return a valid signed transaction.");
        }

        return { signed, latestBlockhash };
      });
    },
    [authorizeSession]
  );
  const signAndSendForAccount = useCallback(
    async (
      transaction: Transaction | VersionedTransaction,
      minContextSlot: number,
      expectedOwner: PublicKey
    ): Promise<TransactionSignature> => {
      return await transact(async (wallet) => {
        const authorized = await authorizeSession(wallet);

        if (!authorized.publicKey.equals(expectedOwner)) {
          throw new Error("Phantom account changed. Payment cancelled.");
        }

        const signatures = await wallet.signAndSendTransactions({
          transactions: [transaction],
          minContextSlot,
        });

        if (!signatures[0]) {
          throw new Error("Phantom did not return a transaction signature.");
        }

        return signatures[0];
      });
    },
    [authorizeSession]
  );
  const signMessage = useCallback(
    async (message: Uint8Array): Promise<Uint8Array> => {
      return await transact(async (wallet) => {
        const authResult = await authorizeSession(wallet);
        const signedMessages = await wallet.signMessages({
          addresses: [authResult.address],
          payloads: [message],
        });
        return signedMessages[0];
      });
    },
    [authorizeSession]
  );

  return useMemo(
    () => ({
      connect,
      signIn,
      disconnect,
      signAndSendTransaction,
      signAndSendForAccount,
      signOnlyForAccount,
      signMessage,
    }),
    [connect, signIn, disconnect, signAndSendTransaction, signAndSendForAccount, signOnlyForAccount, signMessage]
  );
}
