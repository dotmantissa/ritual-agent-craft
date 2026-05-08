import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft,
  Brain,
  CheckCircle2,
  CircleSlash,
  XCircle,
  Zap,
  Receipt,
  Copy,
  Clock,
  Terminal,
  Radio,
  Cpu,
  Send,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/app/runs/$id")({
  head: () => ({ meta: [{ title: "Run — Ritual Agents" }] }),
  component: RunDetail,
});

type Run = {
  id: string;
  agent_id: string;
  status: "success" | "skipped" | "failed";
  triggered_at: string;
  created_at: string;
  trigger_payload: Record<string, unknown>;
  ai_decision: { act: boolean; reason: string; model?: string } | null;
  action_result: Record<string, unknown> | null;
  tx_hash: string | null;
};

type Agent = { id: string; name: string };

function RunDetail() {
  const { id } = Route.useParams();
  const [run, setRun] = useState<Run | null>(null);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("agent_runs")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error || !data) {
        setNotFound(true);
        return;
      }
      setRun(data as unknown as Run);
      const { data: a } = await supabase
        .from("agents")
        .select("id,name")
        .eq("id", (data as { agent_id: string }).agent_id)
        .maybeSingle();
      if (a) setAgent(a as Agent);
    })();
  }, [id]);

  if (notFound) {
    return (
      <div className="glass rounded-2xl p-8 text-center">
        <p className="text-sm text-muted-foreground">Run not found.</p>
        <Link to="/app" className="mt-4 inline-block text-xs text-accent hover:underline">
          ← Back to dashboard
        </Link>
      </div>
    );
  }

  if (!run) {
    return <div className="font-mono-tabular text-sm text-muted-foreground">Loading run…</div>;
  }

  const copy = (val: string) => {
    navigator.clipboard.writeText(val);
    toast.success("Copied");
  };

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/app/agents/$id"
          params={{ id: run.agent_id }}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Back to {agent?.name ?? "agent"}
        </Link>
      </div>

      <div className="glass rounded-2xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <StatusBadge status={run.status} />
            <div>
              <h1 className="text-xl font-bold tracking-tight">Run · {run.id.slice(0, 8)}</h1>
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span className="font-mono-tabular">
                  {new Date(run.triggered_at).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
          {run.tx_hash && (
            <button
              onClick={() => copy(run.tx_hash!)}
              className="group flex items-center gap-2 rounded-lg border border-accent/30 bg-accent/5 px-3 py-2 text-xs"
            >
              <Receipt className="h-3 w-3 text-accent" />
              <span className="font-mono-tabular text-accent">
                {run.tx_hash.slice(0, 14)}…{run.tx_hash.slice(-8)}
              </span>
              <Copy className="h-3 w-3 text-muted-foreground group-hover:text-foreground" />
            </button>
          )}
        </div>
      </div>

      <Section icon={Zap} title="Trigger event" subtitle="The onchain event that fired this run">
        <KeyValueGrid data={run.trigger_payload} />
        <JsonBlock value={run.trigger_payload} />
      </Section>

      <Section icon={Brain} title="AI decision" subtitle="Reasoning produced by the policy model">
        {run.ai_decision ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider",
                  run.ai_decision.act
                    ? "border-success/40 bg-success/10 text-success"
                    : "border-warning/40 bg-warning/10 text-warning",
                )}
              >
                {run.ai_decision.act ? "ACT" : "SKIP"}
              </span>
              {run.ai_decision.model && (
                <span className="font-mono-tabular text-[10px] text-muted-foreground">
                  {run.ai_decision.model}
                </span>
              )}
            </div>
            <p className="text-sm leading-relaxed text-foreground/90">
              {run.ai_decision.reason}
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            No AI policy attached — agent acted on trigger directly.
          </p>
        )}
      </Section>

      <Section
        icon={CheckCircle2}
        title="Action result"
        subtitle="Mock transaction execution output"
      >
        {run.status === "success" && run.action_result ? (
          <>
            <KeyValueGrid data={run.action_result} />
            <JsonBlock value={run.action_result} />
          </>
        ) : run.status === "skipped" ? (
          <p className="text-sm text-muted-foreground">
            Action skipped — AI policy declined to execute.
          </p>
        ) : run.status === "failed" ? (
          <p className="text-sm text-destructive">
            Execution failed.{" "}
            {run.action_result ? <JsonBlock value={run.action_result} /> : null}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">No result recorded.</p>
        )}
      </Section>
    </div>
  );
}

function StatusBadge({ status }: { status: Run["status"] }) {
  const Icon =
    status === "success" ? CheckCircle2 : status === "skipped" ? CircleSlash : XCircle;
  const color =
    status === "success"
      ? "text-success border-success/40 bg-success/10"
      : status === "skipped"
        ? "text-warning border-warning/40 bg-warning/10"
        : "text-destructive border-destructive/40 bg-destructive/10";
  return (
    <div className={cn("grid h-10 w-10 place-items-center rounded-xl border", color)}>
      <Icon className="h-5 w-5" />
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="glass rounded-2xl p-6">
      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-4 w-4 text-accent" />
        <h2 className="text-sm font-semibold uppercase tracking-wider">{title}</h2>
      </div>
      {subtitle && <p className="mb-4 text-xs text-muted-foreground">{subtitle}</p>}
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function KeyValueGrid({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data ?? {}).filter(
    ([, v]) => typeof v !== "object" || v === null,
  );
  if (entries.length === 0) return null;
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {entries.map(([k, v]) => (
        <div key={k} className="rounded-xl border border-border bg-card/30 px-4 py-3">
          <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</dt>
          <dd className="mt-1 break-all font-mono-tabular text-xs">
            {v === null || v === undefined ? "—" : String(v)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function JsonBlock({ value }: { value: unknown }) {
  return (
    <details className="group rounded-xl border border-border bg-background/40">
      <summary className="cursor-pointer select-none px-4 py-2 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground">
        Raw JSON
      </summary>
      <pre className="max-h-80 overflow-auto px-4 pb-4 font-mono-tabular text-[11px] leading-relaxed text-foreground/80">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}
