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

SnapSplit brings the entire process into one mobile flow.

## Solution

With SnapSplit, users can:

- scan a receipt or enter expenses manually
- review and edit receipt items
- add participants
- split the total equally
- assign individual items to specific people
- calculate each person's exact share
- generate USDC or SKR payment requests on Solana
- share or copy payment links directly from the app

## Demo Flow

Receipt → Review → Add people → Split → Generate USDC or SKR request

Example:

- Burger — 12.50 USDC
- Drink — 3.50 USDC
- Total — 16.00 USDC
- Equal split — 8.00 USDC per person
- Item split — 12.50 USDC / 3.50 USDC

## Why Solana

Solana provides fast settlement and low transaction costs, making it suitable for everyday peer-to-peer payments.

SnapSplit uses USDC on Solana so users can settle shared expenses with a dollar-denominated asset instead of relying on volatile token prices.

## Tech Stack

- React Native
- Expo
- TypeScript
- Solana payment URI
- USDC SPL token
- AsyncStorage
- Receipt OCR / image flow

## Payment Requests

SnapSplit generates Solana payment URIs containing:

- recipient wallet
- requested amount
- USDC SPL token mint
- SnapSplit label
- payment message

USDC mint:

`EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`

## Status

Hackathon prototype with a working end-to-end mobile flow:

**Receipt → Split → USDC or SKR request**

## Author

Built by iborazzi for the Solana Mobile ecosystem.

## Verification & Build

### Android release build

    cd android
    ./gradlew assembleRelease

Release APK:

android/app/build/outputs/apk/release/app-release.apk

### Core implementation

- Receipt capture and manual expense entry: src/screens/HomeScreen.tsx
- Receipt review, participant assignment and split calculations: src/screens/ReceiptReviewScreen.tsx
- USDC and SKR Solana payment request generation: src/screens/ReceiptReviewScreen.tsx

### OCR flow

SnapSplit supports receipt-image text extraction and converts detected receipt text into editable receipt items.

The user can review and manually correct parsed items before splitting the bill.

### Solana payment requests

SnapSplit validates the recipient as a Solana public key and generates shareable Solana payment URIs.

Supported request tokens:

- USDC
- SKR

SKR mint:

SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3

The SKR integration supports selectable SKR payment requests, share request, open in wallet, and copy Solana payment URI.

SnapSplit does not claim an automatic USDC-to-SKR exchange-rate conversion.

## Prepared cafe QR and settlement update

This source revision adds a cafe menu QR modal in `src/components/cafe/CafeMenu.tsx`.
Only HTTPS links without embedded credentials are accepted; users see the domain before opening the external menu.
Menu prices are not scraped and orders are not submitted to merchants. Items are entered manually in USDC reference units.

OCR runs through `expo-text-extractor` in `src/screens/HomeScreen.tsx`; detected lines become editable drafts and must be reviewed before splitting.
Split allocation is in `src/screens/ReceiptReviewScreen.tsx`. SKR settlement uses an explicitly entered manual SKR-per-USDC rate, with rounding conserved across the group in `src/domain/settlement.ts`.
Requests include the SPL token mint and an amount in token UI units, not atomic units.
Copy/share/open creates a transfer request; it does not prove an on-chain payment or implement MWA transfer signing.

### Checks

```
npm ci
npm test
npm run typecheck
npm run lint
```

`expo-camera` is a native dependency, so rebuild the Android APK before demonstrating QR scanning. Real camera/OCR and wallet interoperability require device testing. See `handoff/AKSAM-PLANI.md` for the release evidence workflow.

## Verified Android demo

SnapSplit is an Android receipt-splitting app built with Expo and React Native.

- Scan or select a receipt, review detected items, and edit amounts.
- Split the bill equally or assign individual items to people.
- Connect a compatible Android wallet through Mobile Wallet Adapter.
- Generate and share Solana Pay transfer requests for USDC or SKR.
- SKR amounts use a manually agreed rate, not a live market quote.
- Devnet demo mode supports Circle test USDC only.

### Recorded demo

The demo shows a 6.00 USDC receipt, Tom and Jerry, item-based shares
of 3.50 and 2.50 USDC, and SKR request controls with an example agreed rate.

A 3.50 test USDC request for Tom is opened from SnapSplit in Phantom.
The recording shows wallet approval, a "Sent" notification, and the
sender's test USDC balance decreasing from 11.50 to 8.00.

Devnet tokens have no monetary value. The SKR section demonstrates
request configuration; it does not demonstrate an SKR transfer.

### Current limitations

Payments are approved and sent in the external wallet.
SnapSplit does not yet verify payment completion on-chain.
The recorded receipt is denominated in USDC; automatic fiat conversion
is not implemented.

### Validation

Run `npm test`, `npm run typecheck`, and `npm run lint`.
The current lint baseline contains 20 warnings and no errors.
