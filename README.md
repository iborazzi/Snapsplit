# SnapSplit

**SnapSplit turns a receipt into individual USDC payment requests on Solana in seconds.**

SnapSplit is a mobile receipt-splitting app built for Solana. Users can scan or manually enter receipt items, assign expenses to friends, split the bill equally or by item, and generate individual USDC payment requests.

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
- generate USDC payment requests on Solana
- share or copy payment links directly from the app

## Demo Flow

Receipt → Review → Add people → Split → Generate USDC request

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

**Receipt → Split → USDC request**

## Author

Built by iborazzi for the Solana Mobile ecosystem.
