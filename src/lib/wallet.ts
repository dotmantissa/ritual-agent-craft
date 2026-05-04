// Generates a deterministic mock wallet "address" + matching email/password
// so users can sign in with a wallet on every device. In V2 this is replaced
// with real wallet signature verification.

const HEX = "0123456789abcdef";

export function generateMockWallet(): { address: string; secret: string } {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  let address = "0x";
  for (const b of bytes) address += HEX[b >> 4] + HEX[b & 15];

  const secretBytes = new Uint8Array(24);
  crypto.getRandomValues(secretBytes);
  let secret = "";
  for (const b of secretBytes) secret += HEX[b >> 4] + HEX[b & 15];

  return { address, secret };
}

export function shortAddress(address: string | null | undefined): string {
  if (!address) return "—";
  if (address.length < 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

const STORAGE_KEY = "ritual.wallet";

export type StoredWallet = { address: string; secret: string };

export function loadWallet(): StoredWallet | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveWallet(w: StoredWallet): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(w));
}

export function clearWallet(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

// Derive deterministic email/password from the wallet so we can use Supabase
// email auth without exposing it to the user.
export function walletCredentials(w: StoredWallet): { email: string; password: string } {
  return {
    email: `${w.address.toLowerCase()}@wallet.ritualagents.app`,
    password: w.secret,
  };
}
