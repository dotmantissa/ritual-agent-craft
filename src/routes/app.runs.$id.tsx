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
  Search,
  X,
  ExternalLink,
} from "lucide-react";

const TX_HASH_RE = /0x[a-fA-F0-9]{16,}/g;
const explorerUrl = (hash: string) => `https://mockscan.ritual.dev/tx/${hash}`;
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

      <LogsPanel run={run} />
    </div>
  );
}

type LogLevel = "info" | "success" | "warn" | "error";
type LogEntry = {
  ts: Date;
  level: LogLevel;
  source: string;
  message: string;
  icon: React.ComponentType<{ className?: string }>;
  detail?: string;
};

function buildLogs(run: Run): LogEntry[] {
  const triggered = new Date(run.triggered_at);
  const created = new Date(run.created_at);
  const entries: LogEntry[] = [];
  const trig = run.trigger_payload as { type?: string; chain?: string; block?: number };

  entries.push({
    ts: triggered,
    level: "info",
    source: "watcher",
    icon: Radio,
    message: `Trigger detected · ${trig.type ?? "event"}`,
    detail: trig.chain
      ? `chain=${trig.chain}${trig.block ? ` block=${trig.block}` : ""}`
      : undefined,
  });

  entries.push({
    ts: new Date(triggered.getTime() + 120),
    level: "info",
    source: "runtime",
    icon: Terminal,
    message: "Loaded agent policy and trigger payload",
  });

  if (run.ai_decision) {
    entries.push({
      ts: new Date(triggered.getTime() + 380),
      level: "info",
      source: "ai",
      icon: Cpu,
      message: `Evaluating policy with ${run.ai_decision.model ?? "Lovable AI"}`,
    });
    entries.push({
      ts: new Date(triggered.getTime() + 1240),
      level: run.ai_decision.act ? "success" : "warn",
      source: "ai",
      icon: Cpu,
      message: `Decision: ${run.ai_decision.act ? "ACT" : "SKIP"}`,
      detail: run.ai_decision.reason,
    });
  } else {
    entries.push({
      ts: new Date(triggered.getTime() + 200),
      level: "info",
      source: "runtime",
      icon: Terminal,
      message: "No AI policy — proceeding to action",
    });
  }

  if (run.status === "success") {
    entries.push({
      ts: new Date(created.getTime() - 200),
      level: "info",
      source: "chain",
      icon: Send,
      message: "Submitting transaction to mock chain",
    });
    const txHash = run.tx_hash;
    const result = (run.action_result ?? {}) as {
      action_type?: string;
      gas_used?: number | string;
      block?: number | string;
    };
    entries.push({
      ts: created,
      level: "success",
      source: "chain",
      icon: CheckCircle2,
      message: `Transaction confirmed${result.action_type ? ` · ${result.action_type}` : ""}`,
      detail: [
        txHash ? `tx=${txHash}` : null,
        result.block ? `block=${result.block}` : null,
        result.gas_used ? `gas=${result.gas_used}` : null,
      ]
        .filter(Boolean)
        .join(" · ") || undefined,
    });
  } else if (run.status === "skipped") {
    entries.push({
      ts: created,
      level: "warn",
      source: "runtime",
      icon: CircleSlash,
      message: "Run skipped — no transaction submitted",
    });
  } else if (run.status === "failed") {
    entries.push({
      ts: created,
      level: "error",
      source: "chain",
      icon: AlertTriangle,
      message: "Execution failed",
      detail:
        (run.action_result as { error?: string } | null)?.error ??
        "See raw result for details",
    });
  }

  return entries;
}

const ALL_SOURCES = ["watcher", "runtime", "ai", "chain"] as const;
type Source = (typeof ALL_SOURCES)[number];

function LogsPanel({ run }: { run: Run }) {
  const logs = buildLogs(run);
  const start = logs[0]?.ts.getTime() ?? 0;
  const [active, setActive] = useState<Set<Source>>(
    () => new Set(ALL_SOURCES),
  );
  const [query, setQuery] = useState("");
  const [copySources, setCopySources] = useState<Set<Source>>(
    () => new Set(ALL_SOURCES),
  );
  const toggleCopySource = (s: Source) => {
    setCopySources((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  const counts = logs.reduce<Record<string, number>>((acc, l) => {
    acc[l.source] = (acc[l.source] ?? 0) + 1;
    return acc;
  }, {});

  const toggle = (s: Source) => {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  const q = query.trim().toLowerCase();
  const visible = logs.filter((l) => {
    if (!active.has(l.source as Source)) return false;
    if (!q) return true;
    return (
      l.message.toLowerCase().includes(q) ||
      l.source.toLowerCase().includes(q) ||
      (l.detail?.toLowerCase().includes(q) ?? false)
    );
  });

  function highlightMatch(text: string, keyPrefix: string): React.ReactNode {
    if (!q) return text;
    const lower = text.toLowerCase();
    const parts: React.ReactNode[] = [];
    let cursor = 0;
    let i = lower.indexOf(q, cursor);
    let key = 0;
    while (i !== -1) {
      if (i > cursor) parts.push(text.slice(cursor, i));
      parts.push(
        <mark
          key={`${keyPrefix}-m-${key++}`}
          className="rounded bg-accent/30 px-0.5 text-accent-foreground"
        >
          {text.slice(i, i + q.length)}
        </mark>,
      );
      cursor = i + q.length;
      i = lower.indexOf(q, cursor);
    }
    if (cursor < text.length) parts.push(text.slice(cursor));
    return <>{parts}</>;
  }

  function highlight(text: string): React.ReactNode {
    const out: React.ReactNode[] = [];
    let last = 0;
    let key = 0;
    const re = new RegExp(TX_HASH_RE.source, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) {
        out.push(
          <span key={`t-${key++}`}>
            {highlightMatch(text.slice(last, m.index), `t${key}`)}
          </span>,
        );
      }
      const hash = m[0];
      out.push(
        <span
          key={`tx-${key++}`}
          className="inline-flex items-center gap-0.5 align-baseline"
        >
          <a
            href={explorerUrl(hash)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-l border border-r-0 border-accent/30 bg-accent/5 px-1 py-px text-accent hover:bg-accent/10"
            title="View on explorer"
          >
            {highlightMatch(hash, `tx${key}`)}
            <ExternalLink className="h-2.5 w-2.5" />
          </a>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              navigator.clipboard.writeText(hash);
              toast.success("Tx hash copied");
            }}
            className="inline-flex items-center rounded-r border border-accent/30 bg-accent/5 px-1 py-px text-accent hover:bg-accent/10"
            title="Copy tx hash"
            aria-label="Copy tx hash"
          >
            <Copy className="h-2.5 w-2.5" />
          </button>
        </span>,
      );
      last = m.index + hash.length;
    }
    if (last < text.length) {
      out.push(
        <span key={`t-${key++}`}>
          {highlightMatch(text.slice(last), `t${key}`)}
        </span>,
      );
    }
    return <>{out}</>;
  }

  return (
    <div className="glass relative overflow-hidden rounded-2xl scanline">
      <div className="flex flex-col gap-3 border-b border-border px-5 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-accent" />
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              Run logs
            </span>
            {(() => {
              const rows = visible.flatMap((l) => {
                const found = [
                  ...(l.message.match(TX_HASH_RE) ?? []),
                  ...((l.detail?.match(TX_HASH_RE)) ?? []),
                ];
                return found.map((hash) => ({
                  timestamp: l.ts.toISOString(),
                  source: l.source,
                  tx_hash: hash,
                }));
              });
              const hashes = Array.from(new Set(rows.map((r) => r.tx_hash)));
              if (hashes.length === 0) return null;
              const csvEscape = (v: string) =>
                /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
              return (
                <div className="ml-1 inline-flex overflow-hidden rounded-md border border-accent/30 bg-accent/5 text-accent">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(hashes.join("\n"));
                      toast.success(
                        `Copied ${hashes.length} tx hash${hashes.length === 1 ? "" : "es"}`,
                      );
                    }}
                    className="inline-flex items-center gap-1 px-2 py-0.5 font-mono-tabular text-[10px] uppercase tracking-wider hover:bg-accent/10"
                    title="Copy as plain lines"
                  >
                    <Copy className="h-3 w-3" />
                    Copy tx · {hashes.length}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const header = "timestamp,source,tx_hash";
                      const body = rows
                        .map(
                          (r) =>
                            `${csvEscape(r.timestamp)},${csvEscape(r.source)},${csvEscape(r.tx_hash)}`,
                        )
                        .join("\n");
                      navigator.clipboard.writeText(`${header}\n${body}`);
                      toast.success(
                        `Copied ${rows.length} row${rows.length === 1 ? "" : "s"} as CSV`,
                      );
                    }}
                    className="inline-flex items-center gap-1 border-l border-accent/30 px-2 py-0.5 font-mono-tabular text-[10px] uppercase tracking-wider hover:bg-accent/10"
                    title="Copy as CSV with header"
                  >
                    CSV
                  </button>
                </div>
              );
            })()}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {ALL_SOURCES.map((s) => {
              const isActive = active.has(s);
              const count = counts[s] ?? 0;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggle(s)}
                  disabled={count === 0}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono-tabular text-[10px] uppercase tracking-wider transition",
                    count === 0 && "opacity-40",
                    isActive
                      ? sourceStyles(s) + " border-transparent"
                      : "border-border bg-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span>{s}</span>
                  <span className="opacity-70">{count}</span>
                </button>
              );
            })}
            <span className="ml-2 font-mono-tabular text-[10px] text-muted-foreground">
              {visible.length}/{logs.length}
            </span>
          </div>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search logs · tx hash, decision, message…"
            className="w-full rounded-md border border-border bg-background/40 py-1.5 pl-8 pr-8 font-mono-tabular text-[11px] text-foreground placeholder:text-muted-foreground focus:border-accent/50 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
      {visible.length === 0 ? (
        <div className="px-5 py-8 text-center font-mono-tabular text-[11px] text-muted-foreground">
          {q ? `No steps match "${query}".` : "No steps match the selected filters."}
        </div>
      ) : (
      <ol className="relative">
        {visible.map((log, i) => {
          const delta = log.ts.getTime() - start;
          const Icon = log.icon;
          return (
            <li
              key={i}
              className="relative flex gap-4 border-b border-border/60 px-5 py-3 last:border-b-0"
            >
              <div className="flex w-32 shrink-0 flex-col font-mono-tabular text-[10px] leading-tight text-muted-foreground">
                <span>{log.ts.toLocaleTimeString(undefined, { hour12: false })}</span>
                <span className="text-[9px] opacity-60">+{delta}ms</span>
              </div>
              <div className="flex shrink-0 items-start pt-0.5">
                <span
                  className={cn(
                    "grid h-6 w-6 place-items-center rounded-md border",
                    levelStyles(log.level),
                  )}
                >
                  <Icon className="h-3 w-3" />
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "rounded px-1.5 py-px font-mono-tabular text-[9px] uppercase tracking-wider",
                      sourceStyles(log.source),
                    )}
                  >
                    {log.source}
                  </span>
                  <span className="text-sm text-foreground/90">{highlight(log.message)}</span>
                </div>
                {log.detail && (
                  <p className="mt-1 break-all font-mono-tabular text-[11px] text-muted-foreground">
                    {highlight(log.detail)}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      )}
    </div>
  );
}

function levelStyles(level: LogLevel) {
  switch (level) {
    case "success":
      return "border-success/40 bg-success/10 text-success";
    case "warn":
      return "border-warning/40 bg-warning/10 text-warning";
    case "error":
      return "border-destructive/40 bg-destructive/10 text-destructive";
    default:
      return "border-border bg-card/40 text-muted-foreground";
  }
}

function sourceStyles(source: string) {
  switch (source) {
    case "ai":
      return "bg-accent/15 text-accent";
    case "chain":
      return "bg-primary/15 text-primary";
    case "watcher":
      return "bg-success/15 text-success";
    default:
      return "bg-muted text-muted-foreground";
  }
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
