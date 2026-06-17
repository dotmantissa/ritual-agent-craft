import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { forkTemplate, listTemplates } from "@/fns/agents";
import { toast } from "sonner";
import { GitFork, Plus, Sparkles } from "lucide-react";

export const Route = createFileRoute("/app/marketplace")({
  head: () => ({
    meta: [
      { title: "Marketplace — Ritual Agents" },
      { name: "description", content: "Fork pre-built AI agents created by the community." },
    ],
  }),
  component: Marketplace,
});

type Template = {
  id: string; name: string; description: string | null; category: string | null;
  trigger: { type: string }; action: { type: string }; ai_prompt: string | null;
};

function Marketplace() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    listTemplates().then((rows) => {
      if (rows) setTemplates(rows as unknown as Template[]);
    }).catch(console.error);
  }, []);

  const fork = async (id: string) => {
    setBusy(id);
    try {
      await forkTemplate({ data: { template_id: id } });
      toast.success("Agent forked to your library");
      navigate({ to: "/app" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to fork");
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
        <h1 className="mt-3 text-3xl font-bold tracking-tight">Agent Marketplace</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Battle-tested strategies you can fork and customize in one click.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {templates.length === 0 ? (
          <div className="col-span-full glass rounded-2xl p-12 text-center">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-primary neon-glow">
              <Sparkles className="h-7 w-7 text-primary-foreground" />
            </div>
            <h2 className="text-xl font-semibold">No templates yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Apply the Neon schema to seed template agents.
            </p>
            <Button asChild className="mt-6 bg-gradient-primary neon-glow text-primary-foreground hover:opacity-90">
              <Link to="/app/builder" search={{ id: undefined }}><Plus className="mr-2 h-4 w-4" />Build your own</Link>
            </Button>
          </div>
        ) : (
          templates.map((t) => (
            <div key={t.id} className="glass group flex flex-col rounded-2xl p-6 transition-all hover:-translate-y-0.5 hover:neon-glow">
              <div className="mb-3 flex items-center justify-between">
                <span className="rounded-full border border-border bg-card/40 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                  {t.category ?? "general"}
                </span>
                <span className="font-mono-tabular text-[10px] text-muted-foreground">
                  {t.trigger.type} → {t.action.type}
                </span>
              </div>
              <h3 className="text-lg font-semibold">{t.name}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{t.description}</p>
              {t.ai_prompt && (
                <div className="mt-4 rounded-lg border border-border bg-card/30 p-3">
                  <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">AI policy</div>
                  <p className="line-clamp-3 text-xs text-foreground/80">{t.ai_prompt}</p>
                </div>
              )}
              <Button
                onClick={() => fork(t.id)}
                disabled={busy === t.id}
                className="mt-5 bg-gradient-primary text-primary-foreground hover:opacity-90"
              >
                <GitFork className="mr-2 h-4 w-4" />
                {busy === t.id ? "Forking…" : "Fork agent"}
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
