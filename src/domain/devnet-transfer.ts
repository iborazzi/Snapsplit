import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { createTransferCheckedInstruction, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { DEVNET_USDC } from "./settlement";

export const DEVNET_USDC_MINT = new PublicKey(DEVNET_USDC);

export function tokenAmountToUnits(
  amount: string,
  decimals: number
): bigint {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
    throw new Error("Invalid token decimals.");
  }

  if (!/^(0|[1-9]\d*)(\.\d+)?$/.test(amount)) {
    throw new Error("Invalid token amount.");
  }

  const [whole, fraction = ""] = amount.split(".");

  if (fraction.length > decimals) {
    throw new Error("Too many decimal places.");
  }

  const scale = 10n ** BigInt(decimals);
  const units =
    BigInt(whole) * scale +
    BigInt((fraction || "").padEnd(decimals, "0") || "0");

  if (units <= 0n || units > 18446744073709551615n) {
    throw new Error("Token amount out of range.");
  }

  return units;
}

export function buildDevnetUsdcInstruction(params: {
  sourceTokenAccount: PublicKey;
  destinationTokenAccount: PublicKey;
  owner: PublicKey;
  recipient: PublicKey;
  reference: PublicKey;
  amount: string;
  mintDecimals: number;
}): TransactionInstruction {
  const {
    sourceTokenAccount,
    destinationTokenAccount,
    owner,
    recipient,
    reference,
    amount,
    mintDecimals,
  } = params;

  if (owner.equals(recipient)) {
    throw new Error("Sender and recipient must be different.");
  }

  if (reference.equals(owner) || reference.equals(recipient)) {
    throw new Error("Invalid payment reference.");
  }

  const units = tokenAmountToUnits(amount, mintDecimals);

  const instruction = createTransferCheckedInstruction(
    sourceTokenAccount,
    DEVNET_USDC_MINT,
    destinationTokenAccount,
    owner,
    units,
    mintDecimals,
    [],
    TOKEN_PROGRAM_ID
  );

  if (instruction.keys.some(key => key.pubkey.equals(reference))) {
    throw new Error("Payment reference conflicts with instruction accounts.");
  }

  instruction.keys.push({
    pubkey: reference,
    isSigner: false,
    isWritable: false,
  });

  return instruction;
}
