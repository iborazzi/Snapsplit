export type Token = 'USDC' | 'SKR';
export type PaymentNetwork = 'mainnet' | 'devnet';
export const DEVNET_USDC = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
export const MINTS: Record<Token, string> = {
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  SKR: 'SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3',
};
export function positiveDecimal(input: string): number {
  const text = input.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(text)) throw new Error('Enter a positive decimal amount.');
  const value = Number(text);
  if (!Number.isFinite(value) || value <= 0 || value > 1e9) throw new Error('Amount is outside the supported range.');
  return value;
}
export function allocate(units: number, count: number): number[] {
  if (!Number.isSafeInteger(units) || units < 0 || !Number.isInteger(count) || count < 1) throw new Error('Invalid allocation.');
  return Array.from({ length: count }, (_, i) => Math.floor(units / count) + (i < units % count ? 1 : 0));
}
// SKR requests use an explicitly agreed rate, never an implicit 1:1 conversion.
// Distribute rounded token units once across all shares to preserve the total.
export function settlementAmounts(cents: number[], token: Token, rateText: string): string[] {
  if (cents.length === 0) return [];
  if (cents.some(c => !Number.isSafeInteger(c) || c < 0)) throw new Error('Invalid bill share.');
  if (token === 'USDC') return cents.map(c => (c / 100).toFixed(2));
  const rate = positiveDecimal(rateText);
  const raw = cents.map(c => c * rate * 100); // SKR displayed at four decimal places.
  const total = Math.round(raw.reduce((a, b) => a + b, 0));
  if (!Number.isSafeInteger(total)) throw new Error('Settlement amount is too large.');
  const units = raw.map(Math.floor);
  const order = raw.map((n, i) => ({ i, fraction: n - units[i] })).sort((a, b) => b.fraction - a.fraction || a.i - b.i);
  const remainder = total - units.reduce((a, b) => a + b, 0);
  for (let i = 0; i < remainder; i++) units[order[i].i]++;
  return units.map(n => (n / 10000).toFixed(4));
}
export function requestUri(address: string, token: Token, amount: string, person: string, network: PaymentNetwork = 'mainnet', reference?: string): string {
  positiveDecimal(amount);
  if (network === 'devnet' && token !== 'USDC') throw new Error('Devnet demo supports test USDC only.');
  const mint = network === 'devnet' ? DEVNET_USDC : MINTS[token];
  const label = network === 'devnet' ? 'SnapSplit Devnet Demo' : 'SnapSplit';
  return `solana:${address}?amount=${amount}&spl-token=${mint}&label=${encodeURIComponent(label)}&message=${encodeURIComponent(`SnapSplit ${token} request for ${person}`)}${reference ? `&reference=${encodeURIComponent(reference)}` : ""}`;
}
export function menuUrl(input: string): string {
  const url = new URL(input.trim());
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) throw new Error('Scan an HTTPS cafe menu link.');
  return url.toString();
}
