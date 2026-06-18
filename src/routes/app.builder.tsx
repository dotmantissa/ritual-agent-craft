import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { getPrivyToken } from "@/lib/privy-token";

function authHdr(): Record<string, string> {
  const t = getPrivyToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getAgent, saveAgent, testRunAgent } from "@/fns/agents";
import { toast } from "sonner";
import { ArrowRight, Brain, CheckCircle2, CircleSlash, Code2, FlaskConical, Save, XCircle, Zap } from "lucide-react";

export const Route = createFileRoute("/app/builder")({
  validateSearch: (s: Record<string, unknown>) => ({ id: s.id as string | undefined }),
  head: () => ({
    meta: [
      { title: "Agent Builder — Ritual Agents" },
      { name: "description", content: "Visually compose AI agents with triggers, AI policies, and onchain actions." },
    ],
  }),
  component: Builder,
});

type Trigger = { type: "wallet_activity" | "contract_event" | "price_threshold" | "scheduled"; params: Record<string, unknown> };
type Action = { type: "swap" | "transfer" | "contract_call" | "notify"; params: Record<string, unknown> };

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
  const { id } = Route.useSearch();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [trigger, setTrigger] = useState<Trigger>({ type: "wallet_activity", params: { min_usd: 10000 } });
  const [aiPrompt, setAiPrompt] = useState("");
  const [action, setAction] = useState<Action>({ type: "notify", params: { message: "Triggered!" } });
  const [advanced, setAdvanced] = useState(false);
  const [advancedJson, setAdvancedJson] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    event: Record<string, unknown>;
    decision: { act: boolean; reason: string };
    wouldExecute: boolean;
    mockResult: Record<string, unknown> | null;
  } | null>(null);

  useEffect(() => {
    if (!id) return;
    getAgent({ data: { id }, headers: authHdr() }).then((data) => {
        if (!data) return;
        setName((data.name as string) ?? "");
        setDescription((data.description as string) ?? "");
        setTrigger((data.trigger as unknown as Trigger) ?? trigger);
        setAiPrompt((data.ai_prompt as string) ?? "");
        setAction((data.action as unknown as Action) ?? action);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (advanced) {
      setAdvancedJson(JSON.stringify({ trigger, ai_prompt: aiPrompt, action }, null, 2));
    }
  }, [advanced]);

  const onTest = async () => {
    if (!id) {
      toast.error("Save the agent first before running a test");
      return;
    }
    setTesting(true);
    try {
      const result = await testRunAgent({ data: { id }, headers: authHdr() });
      setTestResult(result as typeof testResult);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Test run failed");
    } finally {
      setTesting(false);
    }
  };

  const onSave = async () => {
    if (!name.trim()) {
      toast.error("Name your agent");
      return;
    }
    setSaving(true);
    try {
      let payload = { trigger, ai_prompt: aiPrompt, action };
      if (advanced) {
        try {
          const parsed = JSON.parse(advancedJson);
          payload = parsed;
        } catch {
          toast.error("Invalid JSON in advanced mode");
          setSaving(false);
          return;
        }
      }
      await saveAgent({
        data: {
          id,
          name,
          description,
          ...payload,
          status: "active",
        },
        headers: authHdr(),
      });
      toast.success(id ? "Agent updated" : "Agent deployed");
      navigate({ to: "/app" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{id ? "Edit agent" : "New agent"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Define a trigger, an AI policy, and an action. Deploy to start automating.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-md border border-border bg-card/40 px-3 py-1.5 text-xs">
            <Code2 className="h-3.5 w-3.5" />
            Dev mode
            <Switch checked={advanced} onCheckedChange={setAdvanced} />
          </div>
          {id && (
            <Button
              variant="outline"
              onClick={onTest}
              disabled={testing}
              className="border-border bg-card/40"
            >
              <FlaskConical className="mr-2 h-4 w-4" />
              {testing ? "Testing…" : "Test Run"}
            </Button>
          )}
          <Button onClick={onSave} disabled={saving} className="bg-gradient-primary text-primary-foreground neon-glow hover:opacity-90">
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Deploying…" : "Deploy"}
          </Button>
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

      {advanced ? (
        <div className="glass rounded-2xl p-6">
          <Label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">
            Agent spec (JSON)
          </Label>
          <Textarea
            value={advancedJson}
            onChange={(e) => setAdvancedJson(e.target.value)}
            rows={20}
            className="bg-card/40 font-mono-tabular text-xs"
          />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr_auto_1fr] lg:items-stretch">
          {/* Mobile: numbered steps; Desktop: arrow flow */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground lg:hidden">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-primary/20 text-primary font-mono-tabular text-[10px]">1</span>
            Trigger → AI → Action
          </div>
          {/* Trigger */}
          <Card title="Trigger" subtitle="When this happens" icon={Zap} accent="violet">
            <Select
              value={trigger.type}
              onValueChange={(v) => setTrigger({ type: v as Trigger["type"], params: defaultParamsTrigger(v as Trigger["type"]) })}
            >
              <SelectTrigger className="bg-card/40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(triggerLabels).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <TriggerParams trigger={trigger} setTrigger={setTrigger} />
          </Card>

          <Arrow />

          {/* AI */}
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

          {/* Action */}
          <Card title="Action" subtitle="Then do this" icon={ArrowRight} accent="violet">
            <Select
              value={action.type}
              onValueChange={(v) => setAction({ type: v as Action["type"], params: defaultParamsAction(v as Action["type"]) })}
            >
              <SelectTrigger className="bg-card/40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(actionLabels).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ActionParams action={action} setAction={setAction} />
          </Card>
        </div>
      )}

      {/* Test Run Result Dialog */}
      <Dialog open={!!testResult} onOpenChange={(open) => !open && setTestResult(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-accent" />
              Test Run Result
            </DialogTitle>
          </DialogHeader>
          {testResult && (
            <div className="space-y-4 text-sm">
              <div className="flex items-center gap-2">
                {testResult.wouldExecute ? (
                  <CheckCircle2 className="h-5 w-5 text-success" />
                ) : (
                  <CircleSlash className="h-5 w-5 text-warning" />
                )}
                <span className="font-semibold">
                  AI decision:{" "}
                  <span className={testResult.wouldExecute ? "text-success" : "text-warning"}>
                    {testResult.wouldExecute ? "ACT" : "SKIP"}
                  </span>
                </span>
              </div>
              <p className="text-muted-foreground">{testResult.decision.reason}</p>
              <details className="rounded-xl border border-border bg-background/40">
                <summary className="cursor-pointer select-none px-4 py-2 text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground">
                  Sample event
                </summary>
                <pre className="max-h-48 overflow-auto px-4 pb-4 font-mono-tabular text-[11px] text-foreground/80">
                  {JSON.stringify(testResult.event, null, 2)}
                </pre>
              </details>
              {testResult.mockResult && (
                <details className="rounded-xl border border-border bg-background/40">
                  <summary className="cursor-pointer select-none px-4 py-2 text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground">
                    Mock action result
                  </summary>
                  <pre className="max-h-48 overflow-auto px-4 pb-4 font-mono-tabular text-[11px] text-foreground/80">
                    {JSON.stringify(testResult.mockResult, null, 2)}
                  </pre>
                </details>
              )}
              {!testResult.wouldExecute && (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <XCircle className="h-3.5 w-3.5 text-destructive" />
                  No transaction would be submitted for this event.
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function defaultParamsTrigger(t: Trigger["type"]): Record<string, unknown> {
  switch (t) {
    case "wallet_activity": return { min_usd: 10000 };
    case "contract_event": return { contract: "0x…", event: "Transfer" };
    case "price_threshold": return { asset: "RITUAL", direction: "down", percent: 5 };
    case "scheduled": return { interval_minutes: 60 };
  }
}
function defaultParamsAction(a: Action["type"]): Record<string, unknown> {
  switch (a) {
    case "swap": return { from: "USDC", to: "RITUAL", amount_usd: 100 };
    case "transfer": return { to: "0x…", amount_usd: 50 };
    case "contract_call": return { contract: "0x…", method: "execute" };
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
        <div className={`grid h-9 w-9 place-items-center rounded-lg ${accent === "violet" ? "bg-primary/20 text-primary" : "bg-accent/20 text-accent"}`}>
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
  const set = (k: string, v: unknown) => setTrigger({ ...trigger, params: { ...trigger.params, [k]: v } });
  if (trigger.type === "wallet_activity") {
    return (
      <ParamField label="Min USD value">
        <Input type="number" value={String(trigger.params.min_usd ?? "")} onChange={(e) => set("min_usd", Number(e.target.value))} className="bg-card/40" />
      </ParamField>
    );
  }
  if (trigger.type === "contract_event") {
    return (
      <>
        <ParamField label="Contract address">
          <Input value={String(trigger.params.contract ?? "")} onChange={(e) => set("contract", e.target.value)} className="bg-card/40 font-mono-tabular" />
        </ParamField>
        <ParamField label="Event name">
          <Input value={String(trigger.params.event ?? "")} onChange={(e) => set("event", e.target.value)} className="bg-card/40" />
        </ParamField>
      </>
    );
  }
  if (trigger.type === "price_threshold") {
    return (
      <>
        <ParamField label="Asset">
          <Input value={String(trigger.params.asset ?? "")} onChange={(e) => set("asset", e.target.value)} className="bg-card/40" />
        </ParamField>
        <ParamField label="% change">
          <Input type="number" value={String(trigger.params.percent ?? "")} onChange={(e) => set("percent", Number(e.target.value))} className="bg-card/40" />
        </ParamField>
      </>
    );
  }
  return (
    <ParamField label="Interval (minutes)">
      <Input type="number" value={String(trigger.params.interval_minutes ?? "")} onChange={(e) => set("interval_minutes", Number(e.target.value))} className="bg-card/40" />
    </ParamField>
  );
}

function ActionParams({ action, setAction }: { action: Action; setAction: (a: Action) => void }) {
  const set = (k: string, v: unknown) => setAction({ ...action, params: { ...action.params, [k]: v } });
  if (action.type === "swap") {
    return (
      <>
        <div className="grid grid-cols-2 gap-2">
          <ParamField label="From"><Input value={String(action.params.from ?? "")} onChange={(e) => set("from", e.target.value)} className="bg-card/40" /></ParamField>
          <ParamField label="To"><Input value={String(action.params.to ?? "")} onChange={(e) => set("to", e.target.value)} className="bg-card/40" /></ParamField>
        </div>
        <ParamField label="Amount USD"><Input type="number" value={String(action.params.amount_usd ?? "")} onChange={(e) => set("amount_usd", Number(e.target.value))} className="bg-card/40" /></ParamField>
      </>
    );
  }
  if (action.type === "transfer") {
    return (
      <>
        <ParamField label="To address"><Input value={String(action.params.to ?? "")} onChange={(e) => set("to", e.target.value)} className="bg-card/40 font-mono-tabular" /></ParamField>
        <ParamField label="Amount USD"><Input type="number" value={String(action.params.amount_usd ?? "")} onChange={(e) => set("amount_usd", Number(e.target.value))} className="bg-card/40" /></ParamField>
      </>
    );
  }
  if (action.type === "contract_call") {
    return (
      <>
        <ParamField label="Contract"><Input value={String(action.params.contract ?? "")} onChange={(e) => set("contract", e.target.value)} className="bg-card/40 font-mono-tabular" /></ParamField>
        <ParamField label="Method"><Input value={String(action.params.method ?? "")} onChange={(e) => set("method", e.target.value)} className="bg-card/40" /></ParamField>
      </>
    );
  }
  return (
    <ParamField label="Message"><Input value={String(action.params.message ?? "")} onChange={(e) => set("message", e.target.value)} className="bg-card/40" /></ParamField>
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
