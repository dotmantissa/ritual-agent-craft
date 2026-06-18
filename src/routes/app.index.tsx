import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { listMyAgents, listMyRecentRuns, tickAgents, toggleAgent, deleteAgent } from "@/fns/agents";
import { Plus, Play, Pause, Trash2, Activity, ArrowRight, Sparkles, Zap } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Ritual Agents" },
      { name: "description", content: "Monitor your active AI agents and their onchain activity." },
    ],
  }),
  component: Dashboard,
});

type Agent = {
  id: string; name: string; description: string | null;
  status: "active" | "paused";
  trigger: { type: string; params?: Record<string, unknown> };
  action: { type: string; params?: Record<string, unknown> };
  category: string | null;
};
type Run = { id: string; agent_id: string; status: "success" | "skipped" | "failed"; created_at: string };

function Dashboard() {
  const navigate = useNavigate();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [a, r] = await Promise.all([
        listMyAgents(),
        listMyRecentRuns(),
      ]);
      setAgents((a ?? []) as unknown as Agent[]);
      setRuns((r ?? []) as unknown as Run[]);
    } catch (e) {
      console.error("dashboard fetch failed", e);
      toast.error("Failed to load dashboard — " + (e instanceof Error ? e.message : "unknown error"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!agents.some((a) => a.status === "active")) return;
    const interval = setInterval(async () => {
      try {
        await tickAgents();
        const r = await listMyRecentRuns();
        setRuns((r ?? []) as unknown as Run[]);
      } catch (e) {
        console.error("tick failed", e);
        toast.error("Agent tick failed — " + (e instanceof Error ? e.message : "unknown error"));
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [agents]);

  const active = agents.filter((a) => a.status === "active").length;
  const totalActions = runs.length;
  const successCount = runs.filter((r) => r.status === "success").length;
  const successRate = totalActions > 0 ? Math.round((successCount / totalActions) * 100) : 0;

  if (loading) return <div className="font-mono-tabular text-sm text-muted-foreground">Loading dashboard…</div>;

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mission Control</h1>
          <p className="mt-1 text-sm text-muted-foreground">Live view of your autonomous agents on Ritual.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" className="border-border bg-card/40">
            <Link to="/app/marketplace"><Sparkles className="mr-2 h-4 w-4" />Marketplace</Link>
          </Button>
          <Button asChild className="bg-gradient-primary neon-glow text-primary-foreground hover:opacity-90">
            <Link to="/app/builder" search={{ id: undefined }}><Plus className="mr-2 h-4 w-4" />New agent</Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Active agents" value={active.toString()} />
        <Kpi label="Actions (24h)" value={totalActions.toString()} />
        <Kpi label="Success rate" value={`${successRate}%`} accent="success" />
        <Kpi label="AI calls (24h)" value={runs.filter((r) => r.status !== "skipped").length.toString()} />
      </div>

      {agents.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="glass overflow-hidden rounded-2xl">
          <div className="border-b border-border px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Your agents</div>
          <ul className="divide-y divide-border">
            {agents.map((agent) => {
              const agentRuns = runs.filter((r) => r.agent_id === agent.id);
              return (
                <li key={agent.id} className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-card/40">
                  <div className={cn("h-2 w-2 rounded-full", agent.status === "active" ? "bg-success animate-pulse-slow" : "bg-muted-foreground/40")} />
                  <button onClick={() => navigate({ to: "/app/agents/$id", params: { id: agent.id } })} className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{agent.name}</span>
                      {agent.category && (
                        <span className="rounded-full border border-border bg-card/40 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">{agent.category}</span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="font-mono-tabular">{agent.trigger.type} → {agent.action.type}</span>
                      <span>·</span>
                      <span>{agentRuns.length} actions / 24h</span>
                    </div>
                  </button>
                  <Sparkline runs={agentRuns} />
                  <Button size="icon" variant="ghost" onClick={async () => {
                    const next = agent.status === "active" ? "paused" : "active";
                    await toggleAgent({ data: { id: agent.id, status: next } });
                    toast.success(next === "active" ? "Agent resumed" : "Agent paused");
                    refresh();
                  }}>
                    {agent.status === "active" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                  <Button size="icon" variant="ghost" onClick={async () => {
                    if (!confirm(`Delete "${agent.name}"?`)) return;
                    await deleteAgent({ data: { id: agent.id } });
                    toast.success("Agent deleted");
                    refresh();
                  }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => navigate({ to: "/app/agents/$id", params: { id: agent.id } })}>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: "success" }) {
  return (
    <div className="glass rounded-xl p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("mt-2 font-mono-tabular text-2xl font-semibold", accent === "success" ? "text-success" : "text-gradient")}>{value}</div>
    </div>
  );
}

function Sparkline({ runs }: { runs: Run[] }) {
  const buckets = new Array(12).fill(0) as number[];
  const now = Date.now();
  const window = 24 * 3600 * 1000;
  for (const r of runs) {
    const ago = now - new Date(r.created_at).getTime();
    if (ago > window) continue;
    const idx = Math.min(11, Math.floor((window - ago) / (window / 12)));
    buckets[idx]++;
  }
  const max = Math.max(1, ...buckets);
  return (
    <div className="hidden items-end gap-0.5 sm:flex">
      {buckets.map((v, i) => (
        <div key={i} className="w-1 rounded-sm bg-gradient-primary opacity-80" style={{ height: `${4 + (v / max) * 22}px` }} />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="glass rounded-2xl p-12 text-center">
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-primary neon-glow">
        <Zap className="h-7 w-7 text-primary-foreground" />
      </div>
      <h2 className="text-xl font-semibold">No agents yet</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        Fork a template from the marketplace to start in seconds, or build your own from scratch.
      </p>
      <div className="mt-6 flex justify-center gap-2">
        <Button asChild variant="outline" className="border-border bg-card/40">
          <Link to="/app/marketplace"><Sparkles className="mr-2 h-4 w-4" />Browse marketplace</Link>
        </Button>
        <Button asChild className="bg-gradient-primary neon-glow text-primary-foreground hover:opacity-90">
          <Link to="/app/builder" search={{ id: undefined }}><Plus className="mr-2 h-4 w-4" />Create agent</Link>
        </Button>
      </div>
      <div className="mt-6 inline-flex items-center gap-2 text-xs text-muted-foreground">
        <Activity className="h-3 w-3" /> Engine idle — deploy an agent to start the event stream.
      </div>
    </div>
  );
}
