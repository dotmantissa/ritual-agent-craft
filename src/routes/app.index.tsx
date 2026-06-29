import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { listMyAgents, toggleAgent, deleteAgent } from "@/fns/agents";
import { Plus, Play, Pause, Trash2, ArrowRight, Sparkles, Zap, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getPrivyToken } from "@/lib/privy-token";
import { RITUAL_EXPLORER } from "@/lib/ritualDeploy";
import { shortAddress } from "@/lib/wallet";

function authHdr(): Record<string, string> {
  const t = getPrivyToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export const Route = createFileRoute("/app/")({
  head: () => ({
    meta: [
      { title: "Dashboard | Ritual Agents" },
      { name: "description", content: "Monitor your active AI agents and their onchain activity." },
    ],
  }),
  component: Dashboard,
});

type Agent = {
  id: string;
  name: string;
  description: string | null;
  status: "active" | "paused";
  trigger: { type: string; params?: Record<string, unknown> };
  action: { type: string; params?: Record<string, unknown> };
  category: string | null;
  tx_hash: string | null;
  harness_address: string | null;
  created_at: string;
};

function Dashboard() {
  const navigate = useNavigate();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const headers = authHdr();
    try {
      const a = await listMyAgents({ headers });
      setAgents((a ?? []) as unknown as Agent[]);
    } catch (e) {
      console.error("dashboard fetch failed", e);
      toast.error("Failed to load your agents");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const active = agents.filter((a) => a.status === "active").length;
  const paused = agents.filter((a) => a.status === "paused").length;

  if (loading) {
    return (
      <div className="grid min-h-64 place-items-center">
        <span className="animate-pulse text-sm text-muted-foreground">Loading agents...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Your Agents</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sovereign agent contracts deployed on Ritual Testnet.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" className="border-border bg-card/40">
            <Link to="/app/marketplace">
              <Sparkles className="mr-2 h-4 w-4" />
              Templates
            </Link>
          </Button>
          <Button asChild className="bg-gradient-primary neon-glow text-primary-foreground hover:opacity-90">
            <Link to="/app/builder" search={{ id: undefined, name: undefined, description: undefined, trigger: undefined, ai_prompt: undefined, action: undefined }}>
              <Plus className="mr-2 h-4 w-4" />
              Deploy agent
            </Link>
          </Button>
        </div>
      </div>

      {agents.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Kpi label="Total deployed" value={agents.length.toString()} />
          <Kpi label="Active" value={active.toString()} accent="success" />
          <Kpi label="Paused" value={paused.toString()} />
        </div>
      )}

      {agents.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="glass overflow-hidden rounded-2xl">
          <div className="border-b border-border px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Deployed agents
          </div>
          <ul className="divide-y divide-border">
            {agents.map((agent) => (
              <li
                key={agent.id}
                className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-card/40"
              >
                <div
                  className={cn(
                    "h-2 w-2 shrink-0 rounded-full",
                    agent.status === "active"
                      ? "animate-pulse-slow bg-success"
                      : "bg-muted-foreground/40",
                  )}
                />
                <button
                  onClick={() => navigate({ to: "/app/agents/$id", params: { id: agent.id } })}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{agent.name}</span>
                    {agent.category && (
                      <span className="hidden rounded-full border border-border bg-card/40 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground sm:inline">
                        {agent.category}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="truncate font-mono text-[10px]">
                      {agent.harness_address
                        ? shortAddress(agent.harness_address)
                        : "Deploying..."}
                    </span>
                    {agent.harness_address && (
                      <a
                        href={`${RITUAL_EXPLORER}/address/${agent.harness_address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-accent hover:text-accent/80"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </button>

                <div className="hidden flex-col items-end gap-0.5 sm:flex">
                  <span className="text-xs text-muted-foreground">
                    {agent.trigger.type.replace(/_/g, " ")}
                  </span>
                  <span className="text-[10px] text-muted-foreground/60">
                    → {agent.action.type.replace(/_/g, " ")}
                  </span>
                </div>

                <Button
                  size="icon"
                  variant="ghost"
                  title={agent.status === "active" ? "Pause agent" : "Resume agent"}
                  onClick={async () => {
                    const next = agent.status === "active" ? "paused" : "active";
                    try {
                      await toggleAgent({ data: { id: agent.id, status: next }, headers: authHdr() });
                      toast.success(next === "active" ? "Agent resumed" : "Agent paused");
                      refresh();
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Failed to update agent");
                    }
                  }}
                >
                  {agent.status === "active" ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </Button>

                <Button
                  size="icon"
                  variant="ghost"
                  title="Delete agent"
                  onClick={async () => {
                    if (!confirm(`Delete "${agent.name}"? This cannot be undone.`)) return;
                    try {
                      await deleteAgent({ data: { id: agent.id }, headers: authHdr() });
                      toast.success("Agent deleted");
                      refresh();
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Delete failed");
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>

                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => navigate({ to: "/app/agents/$id", params: { id: agent.id } })}
                >
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </li>
            ))}
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
      <div
        className={cn(
          "mt-2 font-mono text-2xl font-semibold",
          accent === "success" ? "text-success" : "text-gradient",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="glass rounded-2xl p-12 text-center">
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-primary neon-glow">
        <Zap className="h-7 w-7 text-primary-foreground" />
      </div>
      <h2 className="text-xl font-semibold">No agents deployed yet</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        Start from a template or build your own from scratch. Each agent is a sovereign harness
        contract deployed to Ritual Testnet by your wallet.
      </p>
      <div className="mt-6 flex justify-center gap-2">
        <Button asChild variant="outline" className="border-border bg-card/40">
          <Link to="/app/marketplace">
            <Sparkles className="mr-2 h-4 w-4" />
            Browse templates
          </Link>
        </Button>
        <Button asChild className="bg-gradient-primary neon-glow text-primary-foreground hover:opacity-90">
          <Link to="/app/builder" search={{ id: undefined, name: undefined, description: undefined, trigger: undefined, ai_prompt: undefined, action: undefined }}>
            <Plus className="mr-2 h-4 w-4" />
            Deploy agent
          </Link>
        </Button>
      </div>
    </div>
  );
}
