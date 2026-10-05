# SnapSplit

**SnapSplit turns a receipt into individual USDC or SKR payment requests on Solana in seconds.**

SnapSplit is a mobile receipt-splitting app built for Solana. Users can scan or manually enter receipt items, assign expenses to friends, split the bill equally or by item, and generate individual USDC or SKR payment requests.

## Problem

Splitting group expenses is still unnecessarily fragmented.

People often need to:

- calculate everyone's share manually
- send screenshots or messages
- copy wallet addresses
- coordinate payments across multiple apps

SnapSplit brings the process into one mobile flow.

## Solution

With SnapSplit, users can:

- scan a receipt or import one from the gallery
- review and edit detected receipt items
- manually add expenses when needed
- add participants
- split the total equally
- assign individual items to specific people
- calculate each person's exact share
- generate USDC or SKR payment requests on Solana
- share, copy, or open payment requests
- verify supported Solana payments on-chain

## Mobile Flow

Receipt → OCR Review → Add People → Split → Payment Request → Wallet → Verification

Example:

- Coffee — 3.50 USDC
- Tea — 2.50 USDC
- Total — 6.00 USDC
- Tom — 3.50 USDC
- Jerry — 2.50 USDC

## Why Solana

Solana provides fast settlement and low transaction costs, making it suitable for everyday peer-to-peer payments.

SnapSplit uses USDC on Solana so users can settle shared expenses with a dollar-denominated asset instead of relying on volatile token prices.

## Tech Stack

- React Native
- Expo
- TypeScript
- Solana Web3
- Solana Mobile Wallet Adapter
- Solana Pay-compatible payment URIs
- SPL tokens
- AsyncStorage
- `expo-text-extractor`
- Android native release build

## Receipt OCR Flow

SnapSplit supports receipt-image text extraction through `expo-text-extractor`.

The workflow is:

1. Capture a receipt with the camera or import an image from the gallery.
2. Extract detected text from the receipt image.
3. Parse candidate receipt lines into editable item drafts.
4. Present the detected items to the user for review.
5. Allow item names and amounts to be corrected before splitting.
6. Allow manual item entry when extraction is incomplete or unsuitable.

OCR output is therefore not treated as automatically authoritative. The user reviews and confirms receipt data before settlement.

The final demo uses a simple receipt containing:

- Coffee — 3.50
- Tea — 2.50
- Total — 6.00

No unsupported OCR accuracy percentage is claimed.

## Bill Splitting

SnapSplit supports two allocation modes:

### Equal split

The receipt total is divided across participants while preserving the rounded total.

### Item-based split

Individual receipt items can be assigned to one or more participants.

The application calculates each participant's share from the selected assignments and identifies unassigned items before settlement.

Core split logic is implemented in:

`src/screens/ReceiptReviewScreen.tsx`

and settlement calculations are implemented in:

`src/domain/settlement.ts`

## Solana Payment Requests

SnapSplit creates Solana Pay-compatible SPL-token payment requests containing:

- recipient wallet
- requested amount
- SPL token mint
- application label
- payment message
- optional unique payment reference

### Mainnet USDC mint

`EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`

### Devnet test USDC mint

`4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`

Devnet test tokens have no monetary value.

## Wallet Integration

SnapSplit integrates with compatible Solana Android wallets through Solana Mobile Wallet Adapter.

The application can:

- connect to a compatible wallet
- create Solana payment requests
- open requests in an external wallet
- share payment requests
- copy payment URIs

Payment approval and transaction signing are performed by the external wallet.

## On-chain Payment Verification

SnapSplit includes on-chain settlement-verification logic.

The application supports:

- unique payment references
- token-aware expected-payment validation
- recipient validation
- requested amount validation
- network-specific mint validation
- transaction-signature verification
- reference-aware payment lookup logic

During the final hackathon test, a **3.50 Devnet USDC transfer** was successfully verified on-chain using its transaction signature and manually assigned to the participant inside SnapSplit.

The demonstrated transaction-signature verification path is separate from the reference-lookup verification path implemented in the codebase.

SnapSplit does not claim that the final recorded demo proves a successful reference-based lookup unless that exact verification state is shown.

## SKR Integration

SnapSplit supports SKR as a settlement-request option on Solana Mainnet.

SKR mint:

`SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3`

When SKR is selected:

- SnapSplit forces the payment network to Solana Mainnet.
- The participant's USDC-denominated share is converted using a manually agreed SKR-per-USDC rate.
- The generated payment request contains the SKR SPL-token mint.
- The application warns the user to use a Mainnet wallet before opening the request.
- SKR cannot be used in the Devnet USDC demo mode.
- The payment-verification model remains token-aware.

The SKR rate is manually agreed and is **not a live market quote**.

For transparency, the hackathon build demonstrates SKR Mainnet request generation and settlement configuration. It does **not** claim that a real SKR transfer was completed during the demo.

## Android Release

Build command:

```bash
cd android
./gradlew assembleRelease
