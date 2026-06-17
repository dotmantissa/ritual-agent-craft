import { createServerFn } from '@tanstack/react-start';
import { requireAuth } from '@/lib/auth-middleware';
import { getDb } from '@/lib/db';
import { z } from 'zod';
import { generateEvent, executeAction } from '../server/chain/mockChain.server';

const TriggerSchema = z.object({
  type: z.enum(['wallet_activity', 'contract_event', 'price_threshold', 'scheduled']),
  params: z.record(z.string(), z.any()).optional().default({}),
});
const ActionSchema = z.object({
  type: z.enum(['swap', 'transfer', 'contract_call', 'notify']),
  params: z.record(z.string(), z.any()).optional().default({}),
});

const AgentInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(80),
  description: z.string().max(500).optional().default(''),
  trigger: TriggerSchema,
  ai_prompt: z.string().max(2000).optional().default(''),
  action: ActionSchema,
  status: z.enum(['active', 'paused']).optional().default('active'),
});

// ── Data fetching ─────────────────────────────────────────────────────────────

export const listMyAgents = createServerFn({ method: 'GET' })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const sql = getDb();
    const rows = await sql`
      SELECT id, name, description, status, trigger, action, category
      FROM agents
      WHERE owner_id = ${context.userId} AND is_template = false
      ORDER BY created_at DESC
    `;
    return rows;
  });

export const listMyRecentRuns = createServerFn({ method: 'GET' })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const sql = getDb();
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const rows = await sql`
      SELECT id, agent_id, status, created_at
      FROM agent_runs
      WHERE owner_id = ${context.userId} AND created_at >= ${since}
      ORDER BY created_at DESC
      LIMIT 500
    `;
    return rows;
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
    return rows;
  });

export const getAgent = createServerFn({ method: 'GET' })
  .middleware([requireAuth])
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
  .middleware([requireAuth])
  .inputValidator((input: unknown) => z.object({ agentId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const sql = getDb();
    const rows = await sql`
      SELECT * FROM agent_runs
      WHERE agent_id = ${data.agentId} AND owner_id = ${context.userId}
      ORDER BY created_at DESC
      LIMIT 50
    `;
    return rows;
  });

export const getRun = createServerFn({ method: 'GET' })
  .middleware([requireAuth])
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
  .middleware([requireAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const sql = getDb();
    const rows = await sql`SELECT id, name FROM agents WHERE id = ${data.id}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (rows[0] ?? null) as any;
  });

// ── Mutations ─────────────────────────────────────────────────────────────────

export const saveAgent = createServerFn({ method: 'POST' })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => AgentInput.parse(input))
  .handler(async ({ data, context }) => {
    const sql = getDb();
    if (data.id) {
      const rows = await sql`
        UPDATE agents SET
          name = ${data.name}, description = ${data.description},
          trigger = ${JSON.stringify(data.trigger)}, ai_prompt = ${data.ai_prompt},
          action = ${JSON.stringify(data.action)}, status = ${data.status},
          updated_at = now()
        WHERE id = ${data.id} AND owner_id = ${context.userId}
        RETURNING *
      `;
      if (!rows.length) throw new Error('Agent not found');
      return rows[0];
    }
    const rows = await sql`
      INSERT INTO agents (owner_id, name, description, trigger, ai_prompt, action, status)
      VALUES (${context.userId}, ${data.name}, ${data.description},
              ${JSON.stringify(data.trigger)}, ${data.ai_prompt},
              ${JSON.stringify(data.action)}, ${data.status})
      RETURNING *
    `;
    return rows[0];
  });

export const toggleAgent = createServerFn({ method: 'POST' })
  .middleware([requireAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(['active', 'paused']) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const sql = getDb();
    await sql`
      UPDATE agents SET status = ${data.status}, updated_at = now()
      WHERE id = ${data.id} AND owner_id = ${context.userId}
    `;
    return { ok: true };
  });

export const deleteAgent = createServerFn({ method: 'POST' })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const sql = getDb();
    await sql`DELETE FROM agents WHERE id = ${data.id} AND owner_id = ${context.userId}`;
    return { ok: true };
  });

export const forkTemplate = createServerFn({ method: 'POST' })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => z.object({ template_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const sql = getDb();
    const tpls = await sql`SELECT * FROM agents WHERE id = ${data.template_id} AND is_template = true`;
    const tpl = tpls[0];
    if (!tpl) throw new Error('Template not found');
    const rows = await sql`
      INSERT INTO agents (owner_id, name, description, trigger, ai_prompt, action, is_template, forked_from, status, category)
      VALUES (${context.userId}, ${tpl.name as string}, ${tpl.description as string},
              ${JSON.stringify(tpl.trigger)}, ${tpl.ai_prompt as string},
              ${JSON.stringify(tpl.action)}, false, ${tpl.id as string},
              'active', ${tpl.category as string | null})
      RETURNING *
    `;
    return rows[0];
  });

export const tickAgents = createServerFn({ method: 'POST' })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const sql = getDb();
    const agents = await sql`
      SELECT * FROM agents WHERE owner_id = ${context.userId} AND status = 'active'
    `;
    if (!agents.length) return { runs: 0 };

    let runCount = 0;
    const numEvents = Math.min(2, agents.length);
    for (let i = 0; i < numEvents; i++) {
      const event = generateEvent();
      const matching = agents.filter((a) => {
        const trig = (a.trigger ?? {}) as { type?: string };
        return trig.type === event.type;
      });
      if (!matching.length) continue;
      const agent = matching[Math.floor(Math.random() * matching.length)];

      let decision: { act: boolean; reason: string } = { act: true, reason: 'No AI prompt configured.' };
      if ((agent.ai_prompt as string)?.trim().length > 0) {
        const withinLimit = await checkAiRateLimit(sql, context.userId);
        decision = withinLimit
          ? await aiDecide(agent.ai_prompt as string, event)
          : { act: false, reason: `AI rate limit reached (${AI_CALLS_PER_HOUR_LIMIT} calls/hour).` };
      }

      if (!decision.act) {
        await sql`
          INSERT INTO agent_runs (agent_id, owner_id, trigger_payload, ai_decision, status)
          VALUES (${agent.id as string}, ${context.userId},
                  ${JSON.stringify(event)}, ${JSON.stringify(decision)}, 'skipped')
        `;
        runCount++;
        continue;
      }

      const result = executeAction(agent.action as { type: string; params?: Record<string, unknown> });
      await sql`
        INSERT INTO agent_runs (agent_id, owner_id, trigger_payload, ai_decision, action_result, status, tx_hash)
        VALUES (${agent.id as string}, ${context.userId},
                ${JSON.stringify(event)}, ${JSON.stringify(decision)},
                ${JSON.stringify(result)}, ${result.success ? 'success' : 'failed'},
                ${result.tx_hash ?? null})
      `;
      runCount++;
    }
    return { runs: runCount };
  });

const AI_CALLS_PER_HOUR_LIMIT = 50;

async function checkAiRateLimit(
  sql: ReturnType<typeof getDb>,
  userId: string,
): Promise<boolean> {
  const since = new Date(Date.now() - 3_600_000).toISOString();
  const rows = await sql`
    SELECT COUNT(*) as cnt FROM agent_runs
    WHERE owner_id = ${userId} AND status != 'skipped' AND created_at >= ${since}
  `;
  return Number((rows[0] as { cnt: string }).cnt) < AI_CALLS_PER_HOUR_LIMIT;
}

async function aiDecide(
  prompt: string,
  event: { type: string; payload: Record<string, unknown> },
): Promise<{ act: boolean; reason: string }> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return { act: true, reason: 'AI gateway unavailable, defaulting to act.' };
  try {
    const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: "You are an autonomous onchain agent's decision engine. Respond by calling the decide tool." },
          { role: 'user', content: `Agent policy:\n${prompt}\n\nChain event (${event.type}):\n${JSON.stringify(event.payload)}` },
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'decide',
            description: 'Decide whether the agent should act on this event.',
            parameters: {
              type: 'object',
              properties: {
                act: { type: 'boolean', description: 'True to execute, false to skip.' },
                reason: { type: 'string', description: 'Short justification (1-2 sentences).' },
              },
              required: ['act', 'reason'],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: 'function', function: { name: 'decide' } },
      }),
    });
    if (!res.ok) return { act: true, reason: `AI fallback (HTTP ${res.status}).` };
    const json = await res.json();
    const tc = json.choices?.[0]?.message?.tool_calls?.[0];
    if (!tc) return { act: true, reason: 'AI returned no decision; defaulting to act.' };
    const args = JSON.parse(tc.function.arguments);
    return { act: !!args.act, reason: String(args.reason ?? '') };
  } catch {
    return { act: true, reason: 'AI request failed; defaulting to act.' };
  }
}

export const testRunAgent = createServerFn({ method: 'POST' })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const sql = getDb();
    const rows = await sql`
      SELECT id, name, ai_prompt, trigger, action FROM agents
      WHERE id = ${data.id} AND owner_id = ${context.userId}
    `;
    const agent = rows[0];
    if (!agent) throw new Error('Agent not found');

    const event = generateEvent();
    const trig = (agent.trigger ?? {}) as { type?: string };
    if (trig.type) (event as { type: string }).type = trig.type as typeof event.type;

    let decision: { act: boolean; reason: string } = { act: true, reason: 'No AI prompt — agent would always execute.' };
    const prompt = (agent.ai_prompt as string | null) ?? '';
    if (prompt.trim().length > 0) {
      const withinLimit = await checkAiRateLimit(sql, context.userId);
      decision = withinLimit
        ? await aiDecide(prompt, event)
        : { act: false, reason: `AI rate limit reached (${AI_CALLS_PER_HOUR_LIMIT} calls/hour).` };
    }

    const wouldExecute = decision.act;
    const mockResult = wouldExecute
      ? executeAction(agent.action as { type: string; params?: Record<string, unknown> })
      : null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { event: JSON.parse(JSON.stringify(event)) as any, decision, wouldExecute, mockResult: mockResult as any };
  });
