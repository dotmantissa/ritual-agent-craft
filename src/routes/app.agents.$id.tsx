import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { getAgent, getAgentRuns, toggleAgent, deleteAgent } from "@/fns/agents";
import { getPrivyToken } from "@/lib/privy-token";
import { toast } from "sonner";

function authHdr(): Record<string, string> {
  const t = getPrivyToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}
import {
  ArrowLeft,
  Brain,
  CheckCircle2,
  CircleSlash,
  Pencil,
  Pause,
  Play,
  Trash2,
  XCircle,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/agents/$id")({
  head: () => ({
    meta: [{ title: "Agent — Ritual Agents" }],
  }),
  component: AgentDetail,
});

type Agent = {
  id: string;
  name: string;
  description: string | null;
  status: "active" | "paused";
  trigger: { type: string; params?: Record<string, unknown> };
  action: { type: string; params?: Record<string, unknown> };
  ai_prompt: string | null;
};

type Run = {
  id: string;
  status: "success" | "skipped" | "failed";
  triggered_at: string;
  trigger_payload: Record<string, unknown>;
  ai_decision: { act: boolean; reason: string } | null;
  action_result: { tx_hash?: string | null; action_type?: string } | null;
  tx_hash: string | null;
  created_at: string;
};

function AgentDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);

  const load = async () => {
    const headers = authHdr();
    const [a, r] = await Promise.all([
      getAgent({ data: { id }, headers }),
      getAgentRuns({ data: { agentId: id }, headers }),
    ]);
    if (a) setAgent(a as unknown as Agent);
    if (r) setRuns(r as unknown as Run[]);
  };

  useEffect(() => {
    load();
    const interval = setInterval(async () => {
      try {
        const r = await getAgentRuns({ data: { agentId: id }, headers: authHdr() });
        if (r) setRuns(r as unknown as Run[]);
      } catch (e) {
        console.error("poll failed", e);
      }
    }, 4000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!agent) {
    return <div className="font-mono-tabular text-sm text-muted-foreground">Loading agent…</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/app" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> Back to dashboard
        </Link>
      </div>

      <div className="glass rounded-2xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className={cn(
                "h-2.5 w-2.5 rounded-full",
                agent.status === "active" ? "bg-success animate-pulse-slow" : "bg-muted-foreground/40",
              )} />
              <h1 className="text-2xl font-bold tracking-tight">{agent.name}</h1>
            </div>
            {agent.description && (
              <p className="mt-1 text-sm text-muted-foreground">{agent.description}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="border-border bg-card/40" asChild>
              <Link to="/app/builder" search={{ id: agent.id }}>
                <Pencil className="mr-2 h-4 w-4" /> Edit
              </Link>
            </Button>
            <Button
              variant="outline"
              className="border-border bg-card/40"
              onClick={async () => {
                const next = agent.status === "active" ? "paused" : "active";
                await toggleAgent({ data: { id: agent.id, status: next }, headers: authHdr() });
                setAgent({ ...agent, status: next });
                toast.success(next === "active" ? "Resumed" : "Paused");
              }}
            >
              {agent.status === "active" ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
              {agent.status === "active" ? "Pause" : "Resume"}
            </Button>
            <Button
              variant="outline"
              className="border-destructive/40 bg-card/40 text-destructive hover:text-destructive"
              onClick={async () => {
                if (!confirm("Delete this agent?")) return;
                await deleteAgent({ data: { id: agent.id }, headers: authHdr() });
                toast.success("Deleted");
                navigate({ to: "/app" });
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </Button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <SpecBlock icon={Zap} label="Trigger" value={agent.trigger.type} extra={JSON.stringify(agent.trigger.params ?? {}, null, 2)} />
          <SpecBlock icon={Brain} label="AI Policy" value={agent.ai_prompt ? "Custom" : "None"} extra={agent.ai_prompt ?? "(always execute)"} />
          <SpecBlock icon={CheckCircle2} label="Action" value={agent.action.type} extra={JSON.stringify(agent.action.params ?? {}, null, 2)} />
        </div>
      </div>

      <div className="glass relative overflow-hidden rounded-2xl scanline">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse-slow rounded-full bg-success" />
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              Live activity feed
            </span>
          </div>
          <span className="font-mono-tabular text-xs text-muted-foreground">{runs.length} entries</span>
        </div>
        {runs.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-muted-foreground">
            Waiting for first event…
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {runs.map((run) => (
              <li key={run.id}>
                <Link
                  to="/app/runs/$id"
                  params={{ id: run.id }}
                  search={{ q: "" }}
                  className="block px-5 py-4 transition-colors hover:bg-card/40"
                >
                  <div className="flex items-center gap-3">
                    <StatusIcon status={run.status} />
                    <span className="font-mono-tabular text-xs text-muted-foreground">
                      {new Date(run.created_at).toLocaleTimeString()}
                    </span>
                    <span className="text-sm">
                      Trigger fired ·{" "}
                      <span className="font-mono-tabular text-xs text-muted-foreground">
                        {(run.trigger_payload as { type?: string }).type ?? "event"}
                      </span>
                    </span>
                    {run.tx_hash && (
                      <span className="ml-auto font-mono-tabular text-[10px] text-accent">
                        {run.tx_hash.slice(0, 10)}…{run.tx_hash.slice(-6)}
                      </span>
                    )}
                    <ChevronRight className={cn("h-4 w-4 text-muted-foreground", run.tx_hash ? "ml-2" : "ml-auto")} />
                  </div>
                  {run.ai_decision && (
                    <div className="mt-2 ml-6 flex items-start gap-2 text-xs">
                      <Brain className="mt-0.5 h-3 w-3 text-accent" />
                      <span className="text-muted-foreground">
                        <span className={cn("font-medium", run.ai_decision.act ? "text-success" : "text-warning")}>
                          AI {run.ai_decision.act ? "ACT" : "SKIP"}:
                        </span>{" "}
                        {run.ai_decision.reason}
                      </span>
                    </div>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: Run["status"] }) {
  if (status === "success") return <CheckCircle2 className="h-4 w-4 text-success" />;
  if (status === "skipped") return <CircleSlash className="h-4 w-4 text-warning" />;
  return <XCircle className="h-4 w-4 text-destructive" />;
}

function SpecBlock({
  icon: Icon, label, value, extra,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  extra: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card/30 p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className="mt-1 font-medium">{value}</div>
      <pre className="mt-2 max-h-24 overflow-auto whitespace-pre-wrap font-mono-tabular text-[10px] text-muted-foreground">
        {extra}
      </pre>
    </div>
  );
}
