import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getPrivyToken } from "@/lib/privy-token";
import { usePrivy, useSendTransaction } from "@privy-io/react-auth";
import {
  SOVEREIGN_FACTORY,
  RITUAL_CHAIN_ID,
  RITUAL_EXPLORER,
  encodeDeployHarness,
  predictHarness,
  agentUserSalt,
} from "@/lib/ritualDeploy";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getAgent, saveAgent, updateAgent } from "@/fns/agents";
import { toast } from "sonner";
import { ArrowRight, Brain, Rocket, Zap } from "lucide-react";

function authHdr(): Record<string, string> {
  const t = getPrivyToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export const Route = createFileRoute("/app/builder")({
  validateSearch: (s: Record<string, unknown>) => ({
    id: s.id as string | undefined,
    name: s.name as string | undefined,
    description: s.description as string | undefined,
    trigger: s.trigger as string | undefined,
    ai_prompt: s.ai_prompt as string | undefined,
    action: s.action as string | undefined,
  }),
  head: () => ({
    meta: [
      { title: "Agent Builder | Ritual Agents" },
      { name: "description", content: "Build and deploy AI agents as sovereign contracts on Ritual." },
    ],
  }),
  component: Builder,
});

type Trigger = {
  type: "wallet_activity" | "contract_event" | "price_threshold" | "scheduled";
  params: Record<string, unknown>;
};
type Action = {
  type: "swap" | "transfer" | "contract_call" | "notify";
  params: Record<string, unknown>;
};

const triggerLabels: Record<Trigger["type"], string> = {
  wallet_activity: "Wallet activity",
  contract_event: "Contract event",
  price_threshold: "Price threshold",
  scheduled: "Scheduled",
};
const actionLabels: Record<Action["type"], string> = {
  swap: "Swap tokens",
  transfer: "Transfer",
  contract_call: "Call contract",
  notify: "Send notification",
};

function Builder() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { user } = usePrivy();
  const { sendTransaction } = useSendTransaction();

  const isEdit = !!search.id;

  const [name, setName] = useState(search.name ?? "");
  const [description, setDescription] = useState(search.description ?? "");
  const [trigger, setTrigger] = useState<Trigger>(() => {
    if (search.trigger) {
      try { return JSON.parse(search.trigger) as Trigger; } catch { /* fall through */ }
    }
    return { type: "wallet_activity", params: { min_usd: 10000 } };
  });
  const [aiPrompt, setAiPrompt] = useState(search.ai_prompt ?? "");
  const [action, setAction] = useState<Action>(() => {
    if (search.action) {
      try { return JSON.parse(search.action) as Action; } catch { /* fall through */ }
    }
    return { type: "notify", params: { message: "Triggered!" } };
  });
  const [deploying, setDeploying] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!search.id) return;
    getAgent({ data: { id: search.id }, headers: authHdr() }).then((data) => {
      if (!data) return;
      setName((data.name as string) ?? "");
      setDescription((data.description as string) ?? "");
      setTrigger((data.trigger as unknown as Trigger) ?? trigger);
      setAiPrompt((data.ai_prompt as string) ?? "");
      setAction((data.action as unknown as Action) ?? action);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.id]);

  const onSaveEdit = async () => {
    if (!search.id) return;
    if (!name.trim()) { toast.error("Give your agent a name"); return; }
    setSaving(true);
    try {
      await updateAgent({
        data: { id: search.id, name, description, trigger, ai_prompt: aiPrompt, action },
        headers: authHdr(),
      });
      toast.success("Agent updated");
      navigate({ to: "/app/agents/$id", params: { id: search.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const onDeploy = async () => {
    if (!name.trim()) { toast.error("Give your agent a name"); return; }
    const walletAddress = user?.wallet?.address;
    if (!walletAddress) { toast.error("Connect your wallet first"); return; }

    setDeploying(true);
    try {
      const agentId = crypto.randomUUID();
      const salt = agentUserSalt(agentId);

      const [predictedHarness] = await Promise.all([
        predictHarness(walletAddress as `0x${string}`, agentId),
      ]);

      const calldata = encodeDeployHarness(agentId);

      toast.info("Confirm the deployment transaction in your wallet.");

      const result = await sendTransaction({
        to: SOVEREIGN_FACTORY,
        data: calldata,
        chainId: RITUAL_CHAIN_ID,
      });

      const txHash = typeof result === "string" ? result : (result as { hash?: string })?.hash;

      if (!txHash) {
        toast.error("Transaction did not return a hash. Agent not saved.");
        return;
      }

      await saveAgent({
        data: {
          id: agentId,
          name,
          description,
          trigger,
          ai_prompt: aiPrompt,
          action,
          status: "active",
          tx_hash: txHash,
          harness_address: predictedHarness,
        },
        headers: authHdr(),
      });

      toast.success("Agent deployed on Ritual Testnet", {
        description: `Harness: ${predictedHarness.slice(0, 10)}...${predictedHarness.slice(-6)}`,
        action: {
          label: "View transaction",
          onClick: () => window.open(`${RITUAL_EXPLORER}/tx/${txHash}`, "_blank"),
        },
      });

      void salt;

      navigate({ to: "/app/agents/$id", params: { id: agentId } });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      if (msg.toLowerCase().includes("reject") || msg.toLowerCase().includes("denied") || msg.toLowerCase().includes("cancel")) {
        toast.warning("Transaction cancelled. Your agent was not deployed.");
      } else {
        toast.error(`Deployment failed: ${msg}`);
      }
    } finally {
      setDeploying(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {isEdit ? "Edit agent" : "New agent"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isEdit
              ? "Update your agent configuration. Changes take effect immediately."
              : "Configure a trigger, an AI decision policy, and an action. Your wallet will deploy the sovereign harness contract on Ritual Testnet."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isEdit ? (
            <Button
              onClick={onSaveEdit}
              disabled={saving}
              className="bg-gradient-primary text-primary-foreground neon-glow hover:opacity-90"
            >
              {saving ? "Saving..." : "Save changes"}
            </Button>
          ) : (
            <Button
              onClick={onDeploy}
              disabled={deploying}
              className="bg-gradient-primary text-primary-foreground neon-glow hover:opacity-90"
            >
              <Rocket className="mr-2 h-4 w-4" />
              {deploying ? "Deploying..." : "Deploy agent"}
            </Button>
          )}
        </div>
      </div>

      <div className="glass rounded-2xl p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Whale Alert"
              className="mt-1.5 bg-card/40"
            />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Description
            </Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Notify me when a whale moves funds"
              className="mt-1.5 bg-card/40"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr_auto_1fr] lg:items-stretch">
        <Card title="Trigger" subtitle="When this happens" icon={Zap} accent="violet">
          <Select
            value={trigger.type}
            onValueChange={(v) =>
              setTrigger({ type: v as Trigger["type"], params: defaultParamsTrigger(v as Trigger["type"]) })
            }
          >
            <SelectTrigger className="bg-card/40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(triggerLabels).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <TriggerParams trigger={trigger} setTrigger={setTrigger} />
        </Card>

        <Arrow />

        <Card title="AI Decision" subtitle="Optional policy" icon={Brain} accent="cyan">
          <Textarea
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder="e.g. Only act if the move is above $250k and not from a known exchange wallet."
            rows={6}
            className="bg-card/40 text-sm"
          />
          <p className="mt-2 text-[11px] text-muted-foreground">
            Leave empty to always execute on trigger.
          </p>
        </Card>

        <Arrow />

        <Card title="Action" subtitle="Then do this" icon={ArrowRight} accent="violet">
          <Select
            value={action.type}
            onValueChange={(v) =>
              setAction({ type: v as Action["type"], params: defaultParamsAction(v as Action["type"]) })
            }
          >
            <SelectTrigger className="bg-card/40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(actionLabels).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ActionParams action={action} setAction={setAction} />
        </Card>
      </div>

      {!isEdit && (
        <div className="glass rounded-2xl border border-primary/20 p-5">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10">
              <Rocket className="h-4 w-4 text-primary" />
            </div>
            <div className="space-y-1 text-sm">
              <p className="font-medium">Your wallet deploys the agent</p>
              <p className="text-muted-foreground">
                Clicking &quot;Deploy agent&quot; will ask your wallet to sign a transaction that creates a
                sovereign harness contract on Ritual Testnet. The agent is permanently registered
                onchain. Your configuration is saved only after the transaction confirms.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function defaultParamsTrigger(t: Trigger["type"]): Record<string, unknown> {
  switch (t) {
    case "wallet_activity": return { min_usd: 10000 };
    case "contract_event": return { contract: "0x...", event: "Transfer" };
    case "price_threshold": return { asset: "RITUAL", direction: "down", percent: 5 };
    case "scheduled": return { interval_minutes: 60 };
  }
}

function defaultParamsAction(a: Action["type"]): Record<string, unknown> {
  switch (a) {
    case "swap": return { from: "USDC", to: "RITUAL", amount_usd: 100 };
    case "transfer": return { to: "0x...", amount_usd: 50 };
    case "contract_call": return { contract: "0x...", method: "execute" };
    case "notify": return { message: "Trigger fired" };
  }
}

function Card({
  title, subtitle, icon: Icon, accent, children,
}: {
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: "violet" | "cyan";
  children: React.ReactNode;
}) {
  return (
    <div className="glass flex flex-col rounded-2xl p-5">
      <div className="mb-4 flex items-center gap-3">
        <div
          className={`grid h-9 w-9 place-items-center rounded-lg ${accent === "violet" ? "bg-primary/20 text-primary" : "bg-accent/20 text-accent"}`}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{subtitle}</div>
          <div className="font-semibold">{title}</div>
        </div>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Arrow() {
  return (
    <div className="hidden items-center justify-center lg:flex">
      <ArrowRight className="h-5 w-5 text-muted-foreground" />
    </div>
  );
}

function TriggerParams({
  trigger,
  setTrigger,
}: {
  trigger: Trigger;
  setTrigger: (t: Trigger) => void;
}) {
  const set = (k: string, v: unknown) =>
    setTrigger({ ...trigger, params: { ...trigger.params, [k]: v } });

  if (trigger.type === "wallet_activity") {
    return (
      <ParamField label="Min USD value">
        <Input
          type="number"
          value={String(trigger.params.min_usd ?? "")}
          onChange={(e) => set("min_usd", Number(e.target.value))}
          className="bg-card/40"
        />
      </ParamField>
    );
  }
  if (trigger.type === "contract_event") {
    return (
      <>
        <ParamField label="Contract address">
          <Input
            value={String(trigger.params.contract ?? "")}
            onChange={(e) => set("contract", e.target.value)}
            className="bg-card/40 font-mono text-xs"
          />
        </ParamField>
        <ParamField label="Event name">
          <Input
            value={String(trigger.params.event ?? "")}
            onChange={(e) => set("event", e.target.value)}
            className="bg-card/40"
          />
        </ParamField>
      </>
    );
  }
  if (trigger.type === "price_threshold") {
    return (
      <>
        <ParamField label="Asset">
          <Input
            value={String(trigger.params.asset ?? "")}
            onChange={(e) => set("asset", e.target.value)}
            className="bg-card/40"
          />
        </ParamField>
        <ParamField label="Percent change">
          <Input
            type="number"
            value={String(trigger.params.percent ?? "")}
            onChange={(e) => set("percent", Number(e.target.value))}
            className="bg-card/40"
          />
        </ParamField>
      </>
    );
  }
  return (
    <ParamField label="Interval (minutes)">
      <Input
        type="number"
        value={String(trigger.params.interval_minutes ?? "")}
        onChange={(e) => set("interval_minutes", Number(e.target.value))}
        className="bg-card/40"
      />
    </ParamField>
  );
}

function ActionParams({ action, setAction }: { action: Action; setAction: (a: Action) => void }) {
  const set = (k: string, v: unknown) =>
    setAction({ ...action, params: { ...action.params, [k]: v } });

  if (action.type === "swap") {
    return (
      <>
        <div className="grid grid-cols-2 gap-2">
          <ParamField label="From">
            <Input
              value={String(action.params.from ?? "")}
              onChange={(e) => set("from", e.target.value)}
              className="bg-card/40"
            />
          </ParamField>
          <ParamField label="To">
            <Input
              value={String(action.params.to ?? "")}
              onChange={(e) => set("to", e.target.value)}
              className="bg-card/40"
            />
          </ParamField>
        </div>
        <ParamField label="Amount USD">
          <Input
            type="number"
            value={String(action.params.amount_usd ?? "")}
            onChange={(e) => set("amount_usd", Number(e.target.value))}
            className="bg-card/40"
          />
        </ParamField>
      </>
    );
  }
  if (action.type === "transfer") {
    return (
      <>
        <ParamField label="To address">
          <Input
            value={String(action.params.to ?? "")}
            onChange={(e) => set("to", e.target.value)}
            className="bg-card/40 font-mono text-xs"
          />
        </ParamField>
        <ParamField label="Amount USD">
          <Input
            type="number"
            value={String(action.params.amount_usd ?? "")}
            onChange={(e) => set("amount_usd", Number(e.target.value))}
            className="bg-card/40"
          />
        </ParamField>
      </>
    );
  }
  if (action.type === "contract_call") {
    return (
      <>
        <ParamField label="Contract">
          <Input
            value={String(action.params.contract ?? "")}
            onChange={(e) => set("contract", e.target.value)}
            className="bg-card/40 font-mono text-xs"
          />
        </ParamField>
        <ParamField label="Method">
          <Input
            value={String(action.params.method ?? "")}
            onChange={(e) => set("method", e.target.value)}
            className="bg-card/40"
          />
        </ParamField>
      </>
    );
  }
  return (
    <ParamField label="Message">
      <Input
        value={String(action.params.message ?? "")}
        onChange={(e) => set("message", e.target.value)}
        className="bg-card/40"
      />
    </ParamField>
  );
}

function ParamField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
