/**
 * Client-side UUID generation.
 *
 * Every row the user creates carries a `client_id` generated here rather than
 * by the database. That is what makes the mobile outbox safe to replay: a
 * retried insert collides on the unique constraint instead of creating a
 * duplicate.
 *
 * `crypto.randomUUID` is available in modern browsers, Node 19+, and React
 * Native via expo-crypto's polyfill. The fallback keeps the package usable in
 * any stray environment without one.
 */
export function newClientId(): string {
  const cryptoRef = globalThis.crypto;

  if (cryptoRef?.randomUUID) {
    return cryptoRef.randomUUID();
  }

  if (cryptoRef?.getRandomValues) {
    const bytes = cryptoRef.getRandomValues(new Uint8Array(16));
    // RFC 4122 version 4, variant 10xx
    bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
    bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20, 32),
    ].join("-");
  }

  throw new Error("No secure random source available for UUID generation.");
}
