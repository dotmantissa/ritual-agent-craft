import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAgent, getAgentRuns, toggleAgent, deleteAgent, recordFunding, recordLifecycle } from "@/fns/agents";
import { getPrivyToken } from "@/lib/privy-token";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  ExternalLink,
  Wallet,
  Square,
  RotateCcw,
  Copy,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePrivy, useSendTransaction } from "@privy-io/react-auth";
import { parseEther, formatEther } from "viem";
import {
  RITUAL_EXPLORER,
  RITUAL_CHAIN_ID,
  encodeStop,
  encodeRestart,
  getHarnessBalance,
  getHarnessConfigured,
} from "@/lib/ritualDeploy";

function authHdr(): Record<string, string> {
  const t = getPrivyToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export const Route = createFileRoute("/app/agents/$id")({
  head: () => ({
    meta: [{ title: "Agent | Ritual Agents" }],
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
  tx_hash: string | null;
  harness_address: string | null;
  created_at: string;
};

type Run = {
  id: string;
  status: "success" | "skipped" | "failed" | "funded" | "stopped" | "restarted";
  trigger_payload: Record<string, unknown>;
  ai_decision: { act: boolean; reason: string } | null;
  action_result: { tx_hash?: string | null; action_type?: string } | null;
  tx_hash: string | null;
  created_at: string;
};

function AgentDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user } = usePrivy();
  const { sendTransaction } = useSendTransaction();
  const walletAddress = user?.wallet?.address;

  const [agent, setAgent] = useState<Agent | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [harnessBalance, setHarnessBalance] = useState<bigint | null>(null);
  const [harnessConfigured, setHarnessConfigured] = useState<boolean>(false);
  const [fundOpen, setFundOpen] = useState(false);
  const [fundAmount, setFundAmount] = useState("0.1");
  const [funding, setFunding] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [restarting, setRestarting] = useState(false);

  const load = useCallback(async () => {
    const headers = authHdr();
    const [a, r] = await Promise.all([
      getAgent({ data: { id }, headers }),
      getAgentRuns({ data: { agentId: id }, headers }),
    ]);
    if (a) setAgent(a as unknown as Agent);
    if (r) setRuns(r as unknown as Run[]);

    if ((a as unknown as Agent)?.harness_address) {
      const addr = (a as unknown as Agent).harness_address as `0x${string}`;
      const [bal, configured] = await Promise.all([
        getHarnessBalance(addr),
        getHarnessConfigured(addr),
      ]);
      setHarnessBalance(bal);
      setHarnessConfigured(configured);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const refreshRuns = useCallback(async () => {
    try {
      const r = await getAgentRuns({ data: { agentId: id }, headers: authHdr() });
      if (r) setRuns(r as unknown as Run[]);
    } catch (e) {
      console.error("poll failed", e);
    }
  }, [id]);

  useEffect(() => {
    const interval = setInterval(refreshRuns, 10000);
    return () => clearInterval(interval);
  }, [refreshRuns]);

  const handleFund = async () => {
    if (!agent?.harness_address) return;
    const amountNum = parseFloat(fundAmount);
    if (!amountNum || amountNum <= 0) { toast.error("Enter a valid amount"); return; }

    setFunding(true);
    try {
      const value = parseEther(fundAmount as `${number}`);
      const result = await sendTransaction(
        { to: agent.harness_address as `0x${string}`, value, chainId: RITUAL_CHAIN_ID },
        { address: walletAddress as `0x${string}` },
      );
      const txHash = typeof result === "string" ? result : (result as { hash?: string })?.hash;
      if (!txHash) { toast.error("Transaction did not return a hash"); return; }

      await recordFunding({
        data: { agent_id: agent.id, tx_hash: txHash, amount_wei: value.toString() },
        headers: authHdr(),
      });

      toast.success(`Funded agent with ${fundAmount} RITUAL`, {
        action: {
          label: "View transaction",
          onClick: () => window.open(`${RITUAL_EXPLORER}/tx/${txHash}`, "_blank"),
        },
      });
      setFundOpen(false);
      setFundAmount("0.1");

      const newBal = await getHarnessBalance(agent.harness_address as `0x${string}`);
      setHarnessBalance(newBal);
      refreshRuns();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      if (msg.toLowerCase().includes("reject") || msg.toLowerCase().includes("cancel")) {
        toast.warning("Transaction cancelled");
      } else {
        toast.error(`Funding failed: ${msg}`);
      }
    } finally {
      setFunding(false);
    }
  };

  const handleStop = async () => {
    if (!agent?.harness_address) return;
    setStopping(true);
    try {
      const result = await sendTransaction(
        { to: agent.harness_address as `0x${string}`, data: encodeStop(), chainId: RITUAL_CHAIN_ID },
        { address: walletAddress as `0x${string}` },
      );
      const txHash = typeof result === "string" ? result : (result as { hash?: string })?.hash;
      if (!txHash) { toast.error("Transaction did not return a hash"); return; }

      await recordLifecycle({
        data: { agent_id: agent.id, tx_hash: txHash, action: "stopped", new_status: "paused" },
        headers: authHdr(),
      });

      setAgent({ ...agent, status: "paused" });
      toast.success("Agent stopped on Ritual Testnet", {
        action: {
          label: "View transaction",
          onClick: () => window.open(`${RITUAL_EXPLORER}/tx/${txHash}`, "_blank"),
        },
      });
      refreshRuns();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      if (msg.toLowerCase().includes("reject") || msg.toLowerCase().includes("cancel")) {
        toast.warning("Transaction cancelled");
      } else {
        toast.error(`Stop failed: ${msg}`);
      }
    } finally {
      setStopping(false);
    }
  };

  const handleRestart = async () => {
    if (!agent?.harness_address) return;
    setRestarting(true);
    try {
      const result = await sendTransaction(
        { to: agent.harness_address as `0x${string}`, data: encodeRestart(), chainId: RITUAL_CHAIN_ID },
        { address: walletAddress as `0x${string}` },
      );
      const txHash = typeof result === "string" ? result : (result as { hash?: string })?.hash;
      if (!txHash) { toast.error("Transaction did not return a hash"); return; }

      await recordLifecycle({
        data: { agent_id: agent.id, tx_hash: txHash, action: "restarted", new_status: "active" },
        headers: authHdr(),
      });

      setAgent({ ...agent, status: "active" });
      toast.success("Agent restarted on Ritual Testnet", {
        action: {
          label: "View transaction",
          onClick: () => window.open(`${RITUAL_EXPLORER}/tx/${txHash}`, "_blank"),
        },
      });
      refreshRuns();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      if (msg.toLowerCase().includes("reject") || msg.toLowerCase().includes("cancel")) {
        toast.warning("Transaction cancelled");
      } else {
        toast.error(`Restart failed: ${msg}`);
      }
    } finally {
      setRestarting(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!agent) return;
    const next = agent.status === "active" ? "paused" : "active";
    try {
      await toggleAgent({ data: { id: agent.id, status: next }, headers: authHdr() });
      setAgent({ ...agent, status: next });
      toast.success(next === "active" ? "Agent resumed" : "Agent paused");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update agent");
    }
  };

  if (!agent) {
    return (
      <div className="grid min-h-64 place-items-center">
        <span className="animate-pulse text-sm text-muted-foreground">Loading agent...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/app"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Back to agents
        </Link>
      </div>

      {/* Agent header */}
      <div className="glass rounded-2xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "h-2.5 w-2.5 rounded-full",
                  agent.status === "active"
                    ? "animate-pulse-slow bg-success"
                    : "bg-muted-foreground/40",
                )}
              />
              <h1 className="text-2xl font-bold tracking-tight">{agent.name}</h1>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider",
                  agent.status === "active"
                    ? "bg-success/15 text-success"
                    : "bg-muted/40 text-muted-foreground",
                )}
              >
                {agent.status}
              </span>
            </div>
            {agent.description && (
              <p className="mt-1 text-sm text-muted-foreground">{agent.description}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="border-border bg-card/40" asChild>
              <Link to="/app/builder" search={{ id: agent.id, name: undefined, description: undefined, trigger: undefined, ai_prompt: undefined, action: undefined }}>
                <Pencil className="mr-2 h-4 w-4" /> Edit config
              </Link>
            </Button>
            <Button
              variant="outline"
              className="border-border bg-card/40"
              onClick={() => setFundOpen(true)}
            >
              <Wallet className="mr-2 h-4 w-4" /> Fund
            </Button>
            <Button
              variant="outline"
              className="border-destructive/40 bg-card/40 text-destructive hover:text-destructive"
              onClick={async () => {
                if (!confirm("Delete this agent? The onchain harness will remain.")) return;
                await deleteAgent({ data: { id: agent.id }, headers: authHdr() });
                toast.success("Agent deleted");
                navigate({ to: "/app" });
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </Button>
          </div>
        </div>

        {/* On-chain controls */}
        {agent.harness_address && (
          <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-border pt-4">
            <span className="text-xs font-medium text-muted-foreground">Onchain control:</span>
            {harnessConfigured ? (
              agent.status === "active" ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-border bg-card/40"
                  onClick={handleStop}
                  disabled={stopping}
                >
                  <Square className="mr-2 h-3.5 w-3.5" />
                  {stopping ? "Stopping..." : "Stop harness"}
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-border bg-card/40"
                  onClick={handleRestart}
                  disabled={restarting}
                >
                  <RotateCcw className="mr-2 h-3.5 w-3.5" />
                  {restarting ? "Restarting..." : "Restart harness"}
                </Button>
              )
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="border-border bg-card/40"
                onClick={handleToggleStatus}
              >
                {agent.status === "active" ? (
                  <><Pause className="mr-2 h-3.5 w-3.5" /> Pause</>
                ) : (
                  <><Play className="mr-2 h-3.5 w-3.5" /> Resume</>
                )}
              </Button>
            )}
          </div>
        )}

        {/* Spec blocks */}
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <SpecBlock
            icon={Zap}
            label="Trigger"
            value={agent.trigger.type.replace(/_/g, " ")}
            extra={JSON.stringify(agent.trigger.params ?? {}, null, 2)}
          />
          <SpecBlock
            icon={Brain}
            label="AI Policy"
            value={agent.ai_prompt ? "Custom" : "None"}
            extra={agent.ai_prompt ?? "(always execute)"}
          />
          <SpecBlock
            icon={CheckCircle2}
            label="Action"
            value={agent.action.type.replace(/_/g, " ")}
            extra={JSON.stringify(agent.action.params ?? {}, null, 2)}
          />
        </div>
      </div>

      {/* On-chain info */}
      <div className="glass rounded-2xl p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          On-chain details
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <InfoRow
            label="Harness contract"
            value={agent.harness_address ?? "Not yet deployed"}
            mono
            link={
              agent.harness_address
                ? `${RITUAL_EXPLORER}/address/${agent.harness_address}`
                : undefined
            }
            copyable={!!agent.harness_address}
          />
          <InfoRow
            label="Deploy transaction"
            value={agent.tx_hash ? `${agent.tx_hash.slice(0, 18)}...` : "Not recorded"}
            mono
            link={agent.tx_hash ? `${RITUAL_EXPLORER}/tx/${agent.tx_hash}` : undefined}
            copyable={!!agent.tx_hash}
            copyValue={agent.tx_hash ?? undefined}
          />
          <InfoRow
            label="Harness balance"
            value={
              harnessBalance !== null
                ? `${parseFloat(formatEther(harnessBalance)).toFixed(4)} RITUAL`
                : "Loading..."
            }
          />
          <InfoRow
            label="Harness status"
            value={harnessConfigured ? "Configured and running" : "Deployed, awaiting configuration"}
            accent={harnessConfigured ? "success" : undefined}
          />
        </div>
      </div>

      {/* Activity log */}
      <div className="glass overflow-hidden rounded-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            Activity log
          </span>
          <span className="font-mono text-xs text-muted-foreground">{runs.length} entries</span>
        </div>
        {runs.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-muted-foreground">
            No activity recorded yet. Fund the agent or configure the harness to begin.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {runs.map((run) => (
              <li key={run.id} className="px-5 py-4">
                <div className="flex items-center gap-3">
                  <RunIcon status={run.status} />
                  <span className="font-mono text-xs text-muted-foreground">
                    {new Date(run.created_at).toLocaleString()}
                  </span>
                  <span className="flex-1 text-sm">
                    <RunLabel run={run} />
                  </span>
                  {run.tx_hash && (
                    <a
                      href={`${RITUAL_EXPLORER}/tx/${run.tx_hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 font-mono text-[10px] text-accent hover:underline"
                    >
                      {run.tx_hash.slice(0, 8)}...
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  {run.id && (
                    <Link
                      to="/app/runs/$id"
                      params={{ id: run.id }}
                      search={{ q: "" }}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Fund dialog */}
      <Dialog open={fundOpen} onOpenChange={setFundOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-accent" />
              Fund agent harness
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Send RITUAL to the sovereign harness contract to cover execution fees. Your wallet
              will sign the transfer transaction directly to the harness address.
            </p>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Amount (RITUAL)
              </Label>
              <Input
                type="number"
                min="0.001"
                step="0.1"
                value={fundAmount}
                onChange={(e) => setFundAmount(e.target.value)}
                className="mt-1.5 bg-card/40"
              />
            </div>
            {harnessBalance !== null && (
              <p className="text-xs text-muted-foreground">
                Current balance: {parseFloat(formatEther(harnessBalance)).toFixed(4)} RITUAL
              </p>
            )}
            <div className="rounded-lg border border-border bg-card/30 px-3 py-2 font-mono text-[10px] text-muted-foreground break-all">
              {agent.harness_address}
            </div>
            <Button
              onClick={handleFund}
              disabled={funding}
              className="w-full bg-gradient-primary text-primary-foreground neon-glow hover:opacity-90"
            >
              {funding ? "Confirm in wallet..." : `Send ${fundAmount} RITUAL`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RunLabel({ run }: { run: Run }) {
  const payload = run.trigger_payload as { type?: string; action?: string; amount_wei?: string };
  if (payload.type === "funding") {
    const ritual = payload.amount_wei
      ? parseFloat(formatEther(BigInt(payload.amount_wei as string))).toFixed(4)
      : "?";
    return <span>Funded with {ritual} RITUAL</span>;
  }
  if (payload.type === "lifecycle") {
    return <span>Harness {payload.action as string}</span>;
  }
  if (run.ai_decision) {
    return (
      <span>
        Trigger fired{" "}
        <span className={cn("font-medium", run.ai_decision.act ? "text-success" : "text-warning")}>
          {run.ai_decision.act ? "executed" : "skipped"}
        </span>
      </span>
    );
  }
  return <span>Event recorded</span>;
}

function RunIcon({ status }: { status: Run["status"] }) {
  if (status === "success" || status === "funded" || status === "restarted")
    return <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />;
  if (status === "skipped" || status === "stopped")
    return <CircleSlash className="h-4 w-4 shrink-0 text-warning" />;
  return <XCircle className="h-4 w-4 shrink-0 text-destructive" />;
}

function SpecBlock({
  icon: Icon,
  label,
  value,
  extra,
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
      <div className="mt-1 font-medium capitalize">{value}</div>
      <pre className="mt-2 max-h-24 overflow-auto whitespace-pre-wrap font-mono text-[10px] text-muted-foreground">
        {extra}
      </pre>
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono,
  link,
  copyable,
  copyValue,
  accent,
}: {
  label: string;
  value: string;
  mono?: boolean;
  link?: string;
  copyable?: boolean;
  copyValue?: string;
  accent?: "success";
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-center gap-2">
        <span
          className={cn(
            "text-sm",
            mono ? "font-mono text-xs" : "",
            accent === "success" ? "text-success" : "",
          )}
        >
          {value}
        </span>
        {link && (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:text-accent/80"
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
        {copyable && (
          <button
            onClick={() => {
              navigator.clipboard.writeText(copyValue ?? value);
              toast.success("Copied to clipboard");
            }}
            className="text-muted-foreground hover:text-foreground"
          >
            <Copy className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}
