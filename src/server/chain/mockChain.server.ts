// Mock chain adapter — generates fake events and returns fake tx hashes.
// In V2, swap with a real Ritual RPC adapter implementing the same interface.

export type ChainEvent = {
  id: string;
  type: "wallet_activity" | "contract_event" | "price_threshold" | "scheduled";
  block: number;
  timestamp: number;
  payload: Record<string, unknown>;
};

const HEX = "0123456789abcdef";
function hex(n: number) {
  let s = "";
  for (let i = 0; i < n; i++) s += HEX[Math.floor(Math.random() * 16)];
  return s;
}

export function fakeTxHash(): string {
  return "0x" + hex(64);
}

export function generateEvent(): ChainEvent {
  const types: ChainEvent["type"][] = [
    "wallet_activity",
    "contract_event",
    "price_threshold",
    "scheduled",
  ];
  const type = types[Math.floor(Math.random() * types.length)];
  const block = 1_800_000 + Math.floor(Math.random() * 100_000);
  const ts = Date.now();

  const payloads: Record<ChainEvent["type"], Record<string, unknown>> = {
    wallet_activity: {
      from: "0x" + hex(40),
      to: "0x" + hex(40),
      value_usd: Math.floor(Math.random() * 500_000),
      asset: ["USDC", "ETH", "RITUAL", "WBTC"][Math.floor(Math.random() * 4)],
    },
    contract_event: {
      contract: "0x" + hex(40),
      event: ["Swap", "Transfer", "Mint", "Burn"][Math.floor(Math.random() * 4)],
      args: { amount: Math.random() * 1000 },
    },
    price_threshold: {
      asset: ["RITUAL", "ETH", "BTC", "SOL"][Math.floor(Math.random() * 4)],
      price: +(Math.random() * 4000).toFixed(2),
      change_pct: +((Math.random() - 0.5) * 12).toFixed(2),
    },
    scheduled: { tick: Math.floor(ts / 1000) },
  };

  return {
    id: hex(16),
    type,
    block,
    timestamp: ts,
    payload: payloads[type],
  };
}

// Pretend to execute. Returns a tx hash + outcome.
export function executeAction(action: { type: string; params?: Record<string, unknown> }) {
  // 90% success rate
  const success = Math.random() > 0.1;
  return {
    success,
    tx_hash: success ? fakeTxHash() : null,
    chain: "ritual-testnet",
    action_type: action.type,
    params: action.params ?? {},
    gas_used: Math.floor(Math.random() * 200_000) + 21_000,
  };
}
