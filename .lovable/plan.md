
## Goal

Ship a working **Ritual Agents** demo where users can visually build AI-powered onchain agents, watch them react to simulated chain events, and see their decisions/actions in a live dashboard. Real Ritual chain integration is stubbed behind a clean adapter so it can be swapped in later without rewriting the app.

## What we're building (V1 scope)

1. **Landing page** — explains Ritual Agents, key features, CTA to launch app
2. **Agent Builder** — visual IF-THIS-THEN-THAT canvas + advanced JSON/code view
3. **AI Decision Layer** — Lovable AI evaluates triggers & decides actions per agent's prompt
4. **Mock Event Engine** — simulated wallet activity, contract events, price feeds streaming in real-time
5. **Mock Execution Layer** — agents "execute" swaps/transfers/contract calls, logged with tx hashes
6. **Agents Dashboard** — list active/paused agents, toggle, view metrics
7. **Agent Detail / Logs** — real-time activity feed per agent (triggers fired, AI reasoning, actions taken)
8. **Marketplace (lite)** — browse 6–8 prebuilt template agents, fork into your library

Out of scope for V1 (planned for V2): real wallet signing, real Ritual RPC, agent monetization/payments, full developer SDK package.

## User flows

**Create an agent (no-code)**
1. Click "New Agent" → choose template or blank
2. Pick a trigger: *Wallet Activity*, *Contract Event*, *Price Threshold*, *Scheduled*
3. Configure trigger params (address, token, threshold, interval)
4. Add an AI decision step with a natural-language prompt ("Only act if sentiment is bullish")
5. Pick an action: *Swap*, *Transfer*, *Call Contract*, *Notify*
6. Name + deploy → appears in dashboard, starts running against the mock event stream

**Watch it run**
- Dashboard shows active agents, last action, success rate, total actions
- Agent detail page streams logs: `trigger fired → AI decision (with reasoning) → action executed → mock tx hash`

**Marketplace**
- Grid of template agents (Sentiment Trader, Whale Watcher, Auto-DCA, Anomaly Alert, etc.)
- "Fork" copies the agent into the user's library where they can tweak it

## Pages / routes

```text
/                    Landing page
/app                 Dashboard (agent list + metrics)
/app/builder         Visual agent builder (new)
/app/builder/$id     Edit existing agent
/app/agents/$id      Agent detail + live logs
/app/marketplace     Browse template agents
/app/settings        Wallet (mock connect), API keys, theme
```

## Visual design

Dark Web3 aesthetic:
- Near-black background with subtle gradient mesh
- Neon accent: electric violet + cyan, with green/red for success/fail states
- Glassmorphic cards (`backdrop-blur`, faint border, soft glow on hover)
- Mono font for addresses, tx hashes, agent IDs; geometric sans for UI
- Animated pulse on live event streams; subtle scanline on the logs feed

## Architecture

```text
┌─────────────────────────────────────────────────┐
│  Frontend (TanStack Start + Tailwind)           │
│  - Builder canvas, dashboard, logs UI           │
└──────────────┬──────────────────────────────────┘
               │ server functions
┌──────────────▼──────────────────────────────────┐
│  Server functions (createServerFn)              │
│  - agents CRUD, run-tick, ai-decide             │
└──────────────┬──────────────────────────────────┘
               │
       ┌───────┴────────┬──────────────┐
       ▼                ▼              ▼
   Lovable Cloud    Lovable AI    Chain Adapter
   (Postgres+RLS)   (Gemini)      (mock now,
                                   Ritual later)
```

**Data model (Lovable Cloud / Postgres)**
- `profiles` — user profile (id, display_name, avatar)
- `agents` — id, owner_id, name, description, status (active/paused), trigger (jsonb), ai_prompt, action (jsonb), is_template, forked_from
- `agent_runs` — id, agent_id, triggered_at, trigger_payload (jsonb), ai_decision (jsonb), action_result (jsonb), status (success/skipped/failed), tx_hash
- `events` — simulated chain event stream (block, type, payload), used by the engine
- RLS: users see only their own agents/runs; templates are public read

**Chain adapter** (`src/server/chain/`)
- `mockChain.server.ts` — generates synthetic events on a tick, returns fake tx hashes
- `ritualChain.server.ts` — stub interface ready for real RPC
- Single `ChainAdapter` interface so swap is one-line

**Run loop**
- A server function `tickAgents` is called every few seconds from the dashboard (polling for V1; can move to pg_cron later)
- For each active agent: check if any new event matches trigger → if AI step exists, call Lovable AI with prompt + event → if decision is "act", call adapter to execute → write to `agent_runs`

## Builder UX details

- Three-column layout: **Triggers** | **AI Decision** | **Action**, joined by animated arrows
- Each block opens a side panel for config
- "Advanced" toggle reveals the underlying JSON spec — devs can edit directly
- Live "Test Run" button feeds a sample event through the agent and shows AI reasoning before deploying

## Dashboard details

- KPI strip: Active agents, Actions (24h), Success rate, AI calls (24h)
- Agent table with inline pause/resume, last-run timestamp, mini sparkline of activity
- Empty state guides user to marketplace or builder

## Technical notes

- **Stack**: TanStack Start, Tailwind v4, shadcn/ui, Lovable Cloud (auth + DB), Lovable AI Gateway (`google/gemini-3-flash-preview` default)
- **Auth**: Email/password + Google via Lovable Cloud; profiles table with auto-create trigger
- **AI**: Server function calls gateway with structured tool-calling so decisions return `{act: bool, reason: string, params: {...}}` — never freeform JSON parsing
- **Realtime**: Logs page polls `agent_runs` every 2s (Supabase realtime can replace this in V2)
- **Wallet connect**: A mock "Connect Wallet" button that generates a fake address and persists in profile — placeholder for wagmi/viem integration later
- **Security**: All mutations go through server functions with `requireSupabaseAuth`; RLS on every table; AI prompts are user-scoped and length-limited

## What you'll see after implementation

- A polished dark landing page for Ritual Agents
- Sign up → land on dashboard with 0 agents and a "Browse marketplace" prompt
- Fork a template (e.g. "Whale Alert") → it starts running immediately on the simulated event stream
- Open its detail page and watch logs appear: trigger → AI reasoning → mock tx hash
- Build your own agent from scratch in the visual builder, test it, deploy it

## Roadmap (after V1 approval)

- V2: Real wallet (wagmi/viem), Ritual testnet RPC wired into the adapter, marketplace publishing/subscriptions
- V3: Developer SDK as a published npm package, webhook triggers, multi-step agent workflows
