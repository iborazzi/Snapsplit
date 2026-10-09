// Encodes the 64-byte Ed25519 signature without relying on optional wallet deps.
export function encodeBase58(bytes: Uint8Array): string {
  if (bytes.length === 0) throw new Error("Empty signature.");
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let num = 0n;
  for (const byte of bytes) num = (num << 8n) + BigInt(byte);
  let result = "";
  while (num > 0n) {
    result = alphabet[Number(num % 58n)] + result;
    num /= 58n;
  }
  let zeros = 0;
  for (const byte of bytes) {
    if (byte !== 0) break;
    zeros++;
  }
  return "1".repeat(zeros) + result;
}
