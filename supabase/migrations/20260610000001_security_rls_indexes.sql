-- 1. Tighten profiles SELECT policy: only owner can read their own row.
--    Public queries (e.g. display_name for leaderboards) should use a view or
--    a separate restricted policy — not exposing wallet_address to everyone.
drop policy if exists "profiles are viewable by everyone" on public.profiles;

create policy "users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

-- 2. Realtime messages RLS: Supabase realtime.messages is an internal table;
--    we can't add custom RLS policies to it, but we can ensure the
--    agent_runs realtime subscription is filtered to the owner via the
--    existing RLS on agent_runs (users see runs for their agents).
--    No additional migration needed there — the RLS already restricts it.
--    We do document: do NOT publish raw realtime.messages to clients.

-- 3. Additional indexes for performance.
--    agent_runs(agent_id, triggered_at desc) for log queries.
--    agents(owner_id, status) for dashboard + tick queries.
create index if not exists agent_runs_agent_triggered_idx
  on public.agent_runs(agent_id, triggered_at desc);

create index if not exists agents_owner_status_idx
  on public.agents(owner_id, status);

-- 4. Seed template agents for the marketplace.
insert into public.agents (
  id, owner_id, name, description, status, trigger, ai_prompt, action,
  is_template, category, created_at, updated_at
) values
(
  '11111111-0000-0000-0000-000000000001',
  null,
  'Whale Watcher',
  'Fires a notification whenever a wallet moves more than $250k in a single transaction. Great for tracking large players on Ritual.',
  'active',
  '{"type":"wallet_activity","params":{"min_usd":250000}}',
  'Only act if the transfer value is above $250,000 USD and the asset is not a stablecoin. Skip low-confidence events.',
  '{"type":"notify","params":{"message":"🐋 Whale move detected! Large transfer on Ritual."}}',
  true,
  'surveillance',
  now(), now()
),
(
  '11111111-0000-0000-0000-000000000002',
  null,
  'Sentiment Trader',
  'Monitors price movements and uses AI to decide whether market sentiment justifies a swap. Buys RITUAL on dips, exits on pumps.',
  'active',
  '{"type":"price_threshold","params":{"asset":"RITUAL","direction":"down","percent":5}}',
  'Act only if the price drop is greater than 5% within the last hour and overall 24h volume is above average. Skip if we already acted in the last 2 hours.',
  '{"type":"swap","params":{"from":"USDC","to":"RITUAL","amount_usd":500}}',
  true,
  'trading',
  now(), now()
),
(
  '11111111-0000-0000-0000-000000000003',
  null,
  'Auto-DCA',
  'Dollar-cost averages into RITUAL on a fixed schedule. Runs every 60 minutes, swaps a fixed USDC amount regardless of price.',
  'active',
  '{"type":"scheduled","params":{"interval_minutes":60}}',
  'Always execute the DCA. Do not skip unless gas fees would exceed 5% of the swap amount.',
  '{"type":"swap","params":{"from":"USDC","to":"RITUAL","amount_usd":100}}',
  true,
  'trading',
  now(), now()
),
(
  '11111111-0000-0000-0000-000000000004',
  null,
  'Anomaly Alert',
  'Watches for unusual contract events (Mint/Burn spikes) and alerts you instantly. Useful for detecting exploits or unusual protocol activity.',
  'active',
  '{"type":"contract_event","params":{"contract":"0x0000000000000000000000000000000000000000","event":"Mint"}}',
  'Act if the minted amount is more than 10x the rolling 1-hour average. This likely signals an anomaly or exploit. Notify immediately.',
  '{"type":"notify","params":{"message":"⚠️ Anomaly detected: unusual Mint event on monitored contract."}}',
  true,
  'surveillance',
  now(), now()
),
(
  '11111111-0000-0000-0000-000000000005',
  null,
  'Stop-Loss Guardian',
  'Automatically sells RITUAL into USDC if price drops more than 10% from your entry. Protects your downside while you sleep.',
  'active',
  '{"type":"price_threshold","params":{"asset":"RITUAL","direction":"down","percent":10}}',
  'Execute immediately if RITUAL price has fallen more than 10%. Do not wait for confirmation — speed is critical for stop-loss.',
  '{"type":"swap","params":{"from":"RITUAL","to":"USDC","amount_usd":1000}}',
  true,
  'risk',
  now(), now()
),
(
  '11111111-0000-0000-0000-000000000006',
  null,
  'Liquidity Rebalancer',
  'Monitors contract Swap events and rebalances your position when the pool ratio drifts by more than 5%.',
  'active',
  '{"type":"contract_event","params":{"contract":"0x0000000000000000000000000000000000000000","event":"Swap"}}',
  'Only act if the cumulative swap imbalance in the last 30 minutes is greater than 5% of pool TVL. Rebalance proportionally.',
  '{"type":"contract_call","params":{"contract":"0x0000000000000000000000000000000000000000","method":"rebalance"}}',
  true,
  'defi',
  now(), now()
),
(
  '11111111-0000-0000-0000-000000000007',
  null,
  'Gas Price Sniper',
  'Waits for low-gas windows then executes a pending contract call. Saves gas fees by timing transactions intelligently.',
  'active',
  '{"type":"scheduled","params":{"interval_minutes":15}}',
  'Only execute if the estimated gas price is below 20 gwei. Otherwise skip and wait for the next scheduled check.',
  '{"type":"contract_call","params":{"contract":"0x0000000000000000000000000000000000000000","method":"execute"}}',
  true,
  'optimization',
  now(), now()
),
(
  '11111111-0000-0000-0000-000000000008',
  null,
  'Transfer Notifier',
  'Sends an instant alert when any transfer arrives at your watched address. Simple but essential for real-time treasury monitoring.',
  'active',
  '{"type":"wallet_activity","params":{"min_usd":1}}',
  'Always notify on any inbound transfer. Never skip — this is a monitoring agent, not a trading agent.',
  '{"type":"notify","params":{"message":"💸 Transfer received at watched address."}}',
  true,
  'surveillance',
  now(), now()
)
on conflict (id) do nothing;
