import { createServerFn } from '@tanstack/react-start';
import { requireAuth } from '@/lib/auth-middleware';
import { attachAuth } from '@/lib/auth-attacher';
import { getDb } from '@/lib/db';
import { z } from 'zod';

const TriggerSchema = z.object({
  type: z.enum(['wallet_activity', 'contract_event', 'price_threshold', 'scheduled']),
  params: z.record(z.string(), z.any()).optional().default({}),
});
const ActionSchema = z.object({
  type: z.enum(['swap', 'transfer', 'contract_call', 'notify']),
  params: z.record(z.string(), z.any()).optional().default({}),
});

const AgentInput = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(80),
  description: z.string().max(500).optional().default(''),
  trigger: TriggerSchema,
  ai_prompt: z.string().max(2000).optional().default(''),
  action: ActionSchema,
  status: z.enum(['active', 'paused']).optional().default('active'),
  tx_hash: z.string().optional(),
  harness_address: z.string().optional(),
});

// ── Data fetching ─────────────────────────────────────────────────────────────

export const listMyAgents = createServerFn({ method: 'GET' })
  .middleware([attachAuth, requireAuth])
  .handler(async ({ context }) => {
    const sql = getDb();
    const rows = await sql`
      SELECT id, name, description, status, trigger, action, category, tx_hash, harness_address, created_at
      FROM agents
      WHERE owner_id = ${context.userId} AND is_template = false
      ORDER BY created_at DESC
    `;
    return [...rows];
  });

export const listTemplates = createServerFn({ method: 'GET' })
  .handler(async () => {
    const sql = getDb();
    const rows = await sql`
      SELECT id, name, description, category, trigger, action, ai_prompt
      FROM agents
      WHERE is_template = true
      ORDER BY name
    `;
    return [...rows];
  });

export const getAgent = createServerFn({ method: 'GET' })
  .middleware([attachAuth, requireAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const sql = getDb();
    const rows = await sql`
      SELECT * FROM agents
      WHERE id = ${data.id} AND (owner_id = ${context.userId} OR is_template = true)
    `;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (rows[0] ?? null) as any;
  });

export const getAgentRuns = createServerFn({ method: 'GET' })
  .middleware([attachAuth, requireAuth])
  .inputValidator((input: unknown) => z.object({ agentId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const sql = getDb();
    const rows = await sql`
      SELECT * FROM agent_runs
      WHERE agent_id = ${data.agentId} AND owner_id = ${context.userId}
      ORDER BY created_at DESC
      LIMIT 50
    `;
    return [...rows];
  });

export const getRun = createServerFn({ method: 'GET' })
  .middleware([attachAuth, requireAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const sql = getDb();
    const rows = await sql`
      SELECT * FROM agent_runs
      WHERE id = ${data.id} AND owner_id = ${context.userId}
    `;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (rows[0] ?? null) as any;
  });

export const getAgentMeta = createServerFn({ method: 'GET' })
  .middleware([attachAuth, requireAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const sql = getDb();
    const rows = await sql`SELECT id, name FROM agents WHERE id = ${data.id}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (rows[0] ?? null) as any;
  });

// ── Mutations ─────────────────────────────────────────────────────────────────

// Called after on-chain tx succeeds. Stores agent only when deployment is confirmed.
export const saveAgent = createServerFn({ method: 'POST' })
  .middleware([attachAuth, requireAuth])
  .inputValidator((input: unknown) => AgentInput.parse(input))
  .handler(async ({ data, context }) => {
    const sql = getDb();
    const rows = await sql`
      INSERT INTO agents (id, owner_id, name, description, trigger, ai_prompt, action, status, tx_hash, harness_address)
      VALUES (
        ${data.id}, ${context.userId}, ${data.name}, ${data.description},
        ${JSON.stringify(data.trigger)}, ${data.ai_prompt},
        ${JSON.stringify(data.action)}, ${data.status},
        ${data.tx_hash ?? null}, ${data.harness_address ?? null}
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name, description = EXCLUDED.description,
        trigger = EXCLUDED.trigger, ai_prompt = EXCLUDED.ai_prompt,
        action = EXCLUDED.action, status = EXCLUDED.status,
        tx_hash = COALESCE(EXCLUDED.tx_hash, agents.tx_hash),
        harness_address = COALESCE(EXCLUDED.harness_address, agents.harness_address),
        updated_at = now()
      RETURNING *
    `;
    return rows[0];
  });

export const updateAgent = createServerFn({ method: 'POST' })
  .middleware([attachAuth, requireAuth])
  .inputValidator((input: unknown) =>
    z.object({
      id: z.string().uuid(),
      name: z.string().min(1).max(80),
      description: z.string().max(500).optional().default(''),
      trigger: TriggerSchema,
      ai_prompt: z.string().max(2000).optional().default(''),
      action: ActionSchema,
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const sql = getDb();
    const rows = await sql`
      UPDATE agents SET
        name = ${data.name}, description = ${data.description},
        trigger = ${JSON.stringify(data.trigger)}, ai_prompt = ${data.ai_prompt},
        action = ${JSON.stringify(data.action)},
        updated_at = now()
      WHERE id = ${data.id} AND owner_id = ${context.userId}
      RETURNING *
    `;
    if (!rows.length) throw new Error('Agent not found');
    return rows[0];
  });

export const toggleAgent = createServerFn({ method: 'POST' })
  .middleware([attachAuth, requireAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(['active', 'paused']) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const sql = getDb();
    const rows = await sql`
      UPDATE agents SET status = ${data.status}, updated_at = now()
      WHERE id = ${data.id} AND owner_id = ${context.userId}
      RETURNING id, harness_address
    `;
    if (!rows.length) throw new Error('Agent not found');
    return { ok: true, harness_address: rows[0].harness_address };
  });

export const deleteAgent = createServerFn({ method: 'POST' })
  .middleware([attachAuth, requireAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const sql = getDb();
    await sql`DELETE FROM agents WHERE id = ${data.id} AND owner_id = ${context.userId}`;
    return { ok: true };
  });

export const forkTemplate = createServerFn({ method: 'POST' })
  .middleware([attachAuth, requireAuth])
  .inputValidator((input: unknown) => z.object({ template_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const sql = getDb();
    const tpls = await sql`SELECT * FROM agents WHERE id = ${data.template_id} AND is_template = true`;
    const tpl = tpls[0];
    if (!tpl) throw new Error('Template not found');
    // Return template data for the builder to deploy on-chain first
    return {
      name: tpl.name as string,
      description: tpl.description as string,
      trigger: tpl.trigger,
      ai_prompt: tpl.ai_prompt as string,
      action: tpl.action,
      forked_from: tpl.id as string,
    };
  });

// Record a funding event after on-chain tx confirms
export const recordFunding = createServerFn({ method: 'POST' })
  .middleware([attachAuth, requireAuth])
  .inputValidator((input: unknown) =>
    z.object({
      agent_id: z.string().uuid(),
      tx_hash: z.string(),
      amount_wei: z.string(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const sql = getDb();
    await sql`
      INSERT INTO agent_runs (agent_id, owner_id, trigger_payload, status, tx_hash)
      VALUES (
        ${data.agent_id}, ${context.userId},
        ${JSON.stringify({ type: 'funding', amount_wei: data.amount_wei })},
        'success', ${data.tx_hash}
      )
    `;
    return { ok: true };
  });

// Record stop/restart on-chain event after tx confirms
export const recordLifecycle = createServerFn({ method: 'POST' })
  .middleware([attachAuth, requireAuth])
  .inputValidator((input: unknown) =>
    z.object({
      agent_id: z.string().uuid(),
      tx_hash: z.string(),
      action: z.enum(['stopped', 'restarted']),
      new_status: z.enum(['active', 'paused']),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const sql = getDb();
    await sql`
      UPDATE agents SET status = ${data.new_status}, updated_at = now()
      WHERE id = ${data.agent_id} AND owner_id = ${context.userId}
    `;
    await sql`
      INSERT INTO agent_runs (agent_id, owner_id, trigger_payload, status, tx_hash)
      VALUES (
        ${data.agent_id}, ${context.userId},
        ${JSON.stringify({ type: 'lifecycle', action: data.action })},
        ${data.action as string}, ${data.tx_hash}
      )
    `;
    return { ok: true };
  });
