import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { listTemplates, forkTemplate } from "@/fns/agents";
import { toast } from "sonner";
import { GitFork, Plus, Sparkles } from "lucide-react";
import { getPrivyToken } from "@/lib/privy-token";

function authHdr(): Record<string, string> {
  const t = getPrivyToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export const Route = createFileRoute("/app/marketplace")({
  head: () => ({
    meta: [
      { title: "Templates | Ritual Agents" },
      { name: "description", content: "Community agent templates to deploy as sovereign contracts." },
    ],
  }),
  component: Marketplace,
});

type Template = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  trigger: { type: string };
  action: { type: string };
  ai_prompt: string | null;
};

function Marketplace() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    listTemplates()
      .then((rows) => {
        if (rows) setTemplates(rows as unknown as Template[]);
      })
      .catch(console.error);
  }, []);

  const fork = async (id: string) => {
    setBusy(id);
    try {
      const data = await forkTemplate({ data: { template_id: id }, headers: authHdr() });
      if (!data) { toast.error("Template not found"); return; }

      const d = data as {
        name: string;
        description: string;
        trigger: unknown;
        ai_prompt: string;
        action: unknown;
      };

      navigate({
        to: "/app/builder",
        search: {
          id: undefined,
          name: d.name,
          description: d.description ?? "",
          trigger: JSON.stringify(d.trigger),
          ai_prompt: d.ai_prompt ?? "",
          action: JSON.stringify(d.action),
        },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load template");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/40 px-3 py-1 text-xs text-muted-foreground">
          <Sparkles className="h-3 w-3" /> Community templates
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">Agent Templates</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Battle-tested agent configurations. Selecting one opens the builder with the config
          pre-filled. Your wallet still deploys the contract.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {templates.length === 0 ? (
          <div className="col-span-full glass rounded-2xl p-12 text-center">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-primary neon-glow">
              <Sparkles className="h-7 w-7 text-primary-foreground" />
            </div>
            <h2 className="text-xl font-semibold">No templates yet</h2>
            <Button asChild className="mt-6 bg-gradient-primary neon-glow text-primary-foreground hover:opacity-90">
              <Link to="/app/builder" search={{ id: undefined, name: undefined, description: undefined, trigger: undefined, ai_prompt: undefined, action: undefined }}>
                <Plus className="mr-2 h-4 w-4" />
                Build your own
              </Link>
            </Button>
          </div>
        ) : (
          templates.map((t) => (
            <div
              key={t.id}
              className="glass group flex flex-col rounded-2xl p-6 transition-all hover:neon-glow"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="rounded-full border border-border bg-card/40 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                  {t.category ?? "general"}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {t.trigger.type.replace(/_/g, " ")} → {t.action.type.replace(/_/g, " ")}
                </span>
              </div>
              <h3 className="text-lg font-semibold">{t.name}</h3>
              <p className="mt-2 flex-1 text-sm text-muted-foreground">{t.description}</p>
              {t.ai_prompt && (
                <div className="mt-4 rounded-lg border border-border bg-card/30 p-3">
                  <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                    AI policy
                  </div>
                  <p className="line-clamp-3 text-xs text-foreground/80">{t.ai_prompt}</p>
                </div>
              )}
              <Button
                onClick={() => fork(t.id)}
                disabled={busy === t.id}
                className="mt-5 bg-gradient-primary text-primary-foreground hover:opacity-90"
              >
                <GitFork className="mr-2 h-4 w-4" />
                {busy === t.id ? "Loading..." : "Use this template"}
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
