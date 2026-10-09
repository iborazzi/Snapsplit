import {
  Connection,
  PublicKey,
  Transaction,
  clusterApiUrl,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  getMint,
  getAccount,
  createAssociatedTokenAccountIdempotentInstruction,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  buildDevnetUsdcInstruction,
  DEVNET_USDC_MINT,
  tokenAmountToUnits,
} from "./devnet-transfer";

export async function prepareDevnetPayment(params: {
  owner: PublicKey;
  recipient: PublicKey;
  reference: PublicKey;
  amount: string;
}) {
  const { owner, recipient, reference, amount } = params;

  if (owner.equals(recipient)) {
    throw new Error("Sender and recipient cannot be the same.");
  }

  if (
    reference.equals(owner) ||
    reference.equals(recipient) ||
    reference.equals(DEVNET_USDC_MINT)
  ) {
    throw new Error("Invalid payment reference.");
  }

  const connection = new Connection(
    clusterApiUrl("devnet"),
    "confirmed"
  );

  const mint = await getMint(
    connection,
    DEVNET_USDC_MINT,
    "confirmed",
    TOKEN_PROGRAM_ID
  );

  if (mint.decimals !== 6) {
    throw new Error("Unexpected Devnet USDC decimals.");
  }

  const sourceTokenAccount = getAssociatedTokenAddressSync(
    DEVNET_USDC_MINT,
    owner
  );

  const destinationTokenAccount = getAssociatedTokenAddressSync(
    DEVNET_USDC_MINT,
    recipient
  );

  const source = await getAccount(
    connection,
    sourceTokenAccount,
    "confirmed",
    TOKEN_PROGRAM_ID
  );

  if (
    !source.owner.equals(owner) ||
    !source.mint.equals(DEVNET_USDC_MINT)
  ) {
    throw new Error("Invalid sender token account.");
  }

  const destination = await connection.getAccountInfo(
    destinationTokenAccount,
    "confirmed"
  );

  if (destination) {
    const parsedDestination = await getAccount(
      connection,
      destinationTokenAccount,
      "confirmed",
      TOKEN_PROGRAM_ID
    );

    if (
      !parsedDestination.owner.equals(recipient) ||
      !parsedDestination.mint.equals(DEVNET_USDC_MINT)
    ) {
      throw new Error("Invalid recipient token account.");
    }
  }

  const requiredUnits = tokenAmountToUnits(
    amount,
    mint.decimals
  );

  if (source.amount < requiredUnits) {
    throw new Error("Insufficient Devnet USDC balance.");
  }

  const instruction = buildDevnetUsdcInstruction({
    sourceTokenAccount,
    destinationTokenAccount,
    owner,
    recipient,
    reference,
    amount,
    mintDecimals: mint.decimals,
  });

  const latestBlockhash = await connection.getLatestBlockhashAndContext(
    "confirmed"
  );

  const transaction = new Transaction({
    feePayer: owner,
    recentBlockhash: latestBlockhash.value.blockhash,
  });

  if (!destination) {
    transaction.add(
      createAssociatedTokenAccountIdempotentInstruction(
        owner,
        destinationTokenAccount,
        recipient,
        DEVNET_USDC_MINT,
        TOKEN_PROGRAM_ID
      )
    );
  }

  transaction.add(instruction);

  return {
    transaction,
    connection,
    minContextSlot: latestBlockhash.context.slot,
    latestBlockhash: latestBlockhash.value,
    sourceTokenAccount,
    destinationTokenAccount,
  };
}
