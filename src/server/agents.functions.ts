import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { generateEvent, executeAction } from "./chain/mockChain.server";

const TriggerSchema = z.object({
  type: z.enum(["wallet_activity", "contract_event", "price_threshold", "scheduled"]),
  params: z.record(z.string(), z.any()).optional().default({}),
});
const ActionSchema = z.object({
  type: z.enum(["swap", "transfer", "contract_call", "notify"]),
  params: z.record(z.string(), z.any()).optional().default({}),
});

const AgentInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(80),
  description: z.string().max(500).optional().default(""),
  trigger: TriggerSchema,
  ai_prompt: z.string().max(2000).optional().default(""),
  action: ActionSchema,
  status: z.enum(["active", "paused"]).optional().default("active"),
});

export const saveAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AgentInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.id) {
      const { data: row, error } = await supabase
        .from("agents")
        .update({
          name: data.name,
          description: data.description,
          trigger: data.trigger,
          ai_prompt: data.ai_prompt,
          action: data.action,
          status: data.status,
        })
        .eq("id", data.id)
        .eq("owner_id", userId)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await supabase
      .from("agents")
      .insert({
        owner_id: userId,
        name: data.name,
        description: data.description,
        trigger: data.trigger,
        ai_prompt: data.ai_prompt,
        action: data.action,
        status: data.status,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const toggleAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["active", "paused"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("agents")
      .update({ status: data.status })
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("agents")
      .delete()
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const forkTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ template_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: tpl, error: e1 } = await supabase
      .from("agents")
      .select("*")
      .eq("id", data.template_id)
      .eq("is_template", true)
      .single();
    if (e1 || !tpl) throw new Error("Template not found");
    const { data: row, error } = await supabase
      .from("agents")
      .insert({
        owner_id: userId,
        name: tpl.name,
        description: tpl.description,
        trigger: tpl.trigger,
        ai_prompt: tpl.ai_prompt,
        action: tpl.action,
        is_template: false,
        forked_from: tpl.id,
        status: "active",
        category: tpl.category,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

// Run a single tick: generate an event, pick a random active agent of matching trigger,
// optionally call AI, then execute and log.
export const tickAgents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: agents, error: agentsErr } = await supabase
      .from("agents")
      .select("*")
      .eq("owner_id", userId)
      .eq("status", "active");
    if (agentsErr) throw new Error(agentsErr.message);
    if (!agents || agents.length === 0) return { runs: 0 };

    let runCount = 0;
    // Up to 2 events per tick
    const numEvents = Math.min(2, agents.length);
    for (let i = 0; i < numEvents; i++) {
      const event = generateEvent();
      const matching = agents.filter((a) => {
        const trig = (a.trigger ?? {}) as { type?: string };
        return trig.type === event.type;
      });
      if (matching.length === 0) continue;
      const agent = matching[Math.floor(Math.random() * matching.length)];

      // AI decision
      let decision: { act: boolean; reason: string } = { act: true, reason: "No AI prompt configured." };
      if (agent.ai_prompt && agent.ai_prompt.trim().length > 0) {
        decision = await aiDecide(agent.ai_prompt, event);
      }

      if (!decision.act) {
        await supabase.from("agent_runs").insert({
          agent_id: agent.id,
          owner_id: userId,
          trigger_payload: event,
          ai_decision: decision,
          action_result: null,
          status: "skipped",
        });
        runCount++;
        continue;
      }

      const result = executeAction(agent.action as { type: string; params?: Record<string, unknown> });
      await supabase.from("agent_runs").insert({
        agent_id: agent.id,
        owner_id: userId,
        trigger_payload: event,
        ai_decision: decision,
        action_result: result,
        status: result.success ? "success" : "failed",
        tx_hash: result.tx_hash,
      });
      runCount++;
    }

    return { runs: runCount };
  });

async function aiDecide(
  prompt: string,
  event: { type: string; payload: Record<string, unknown> },
): Promise<{ act: boolean; reason: string }> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) {
    return { act: true, reason: "AI gateway unavailable, defaulting to act." };
  }
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content:
              "You are an autonomous onchain agent's decision engine. Given the user's policy and a chain event, decide whether to ACT or SKIP. Respond by calling the decide tool.",
          },
          {
            role: "user",
            content: `Agent policy:\n${prompt}\n\nChain event (${event.type}):\n${JSON.stringify(event.payload)}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "decide",
              description: "Decide whether the agent should act on this event.",
              parameters: {
                type: "object",
                properties: {
                  act: { type: "boolean", description: "True to execute, false to skip." },
                  reason: { type: "string", description: "Short justification (1-2 sentences)." },
                },
                required: ["act", "reason"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "decide" } },
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error("AI gateway error", res.status, text);
      return { act: true, reason: `AI fallback (HTTP ${res.status}).` };
    }
    const json = await res.json();
    const tc = json.choices?.[0]?.message?.tool_calls?.[0];
    if (!tc) return { act: true, reason: "AI returned no decision; defaulting to act." };
    const args = JSON.parse(tc.function.arguments);
    return { act: !!args.act, reason: String(args.reason ?? "") };
  } catch (err) {
    console.error("AI decide failed", err);
    return { act: true, reason: "AI request failed; defaulting to act." };
  }
}
