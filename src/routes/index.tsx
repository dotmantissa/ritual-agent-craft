import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Zap, Brain, Activity, ShieldCheck, Sparkles, Wallet } from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";
import { useEffect } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ritual Agents | Autonomous AI agents on Ritual" },
      { name: "description", content: "Deploy autonomous AI agents as sovereign contracts on Ritual Testnet." },
      { property: "og:title", content: "Ritual Agents" },
      {
        property: "og:description",
        content: "Build AI agents that monitor, decide, and execute onchain on Ritual.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  const { ready, authenticated, login } = usePrivy();

  useEffect(() => {
    if (ready && authenticated) navigate({ to: "/app" });
  }, [ready, authenticated, navigate]);

  const launch = () => login();

  return (
    <div className="min-h-screen">
      <Header />

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-40" />
        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-card/40 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
              <span className="h-1.5 w-1.5 animate-pulse-slow rounded-full bg-success" />
              Live on Ritual Testnet
            </div>
            <h1 className="mt-6 text-balance text-5xl font-bold tracking-tight sm:text-7xl">
              Autonomous <span className="text-gradient">AI agents</span>
              <br />
              that act onchain.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted-foreground">
              Deploy sovereign harness contracts on Ritual. Your wallet deploys, your agent runs.
              Nothing in between.
            </p>
            <div className="mt-10 flex justify-center">
              <Button
                size="lg"
                onClick={launch}
                disabled={!ready}
                className="bg-gradient-primary neon-glow text-primary-foreground hover:opacity-90"
              >
                <Wallet className="mr-2 h-5 w-5" />
                Launch app
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            One platform. Every <span className="text-gradient">automation</span>.
          </h2>
          <p className="mt-4 text-muted-foreground">
            From sentiment trading to whale alerts, anomaly detection, and DCA strategies. Agents
            do the work while you sleep.
          </p>
        </div>

        <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Feature
            icon={Zap}
            title="Visual Builder"
            desc="Pick a trigger, write a policy, choose an action. Deploy as a sovereign contract in one transaction."
          />
          <Feature
            icon={Brain}
            title="AI Decision Layer"
            desc="Every event is evaluated by an LLM against your custom policy. Smart agents, not blind bots."
          />
          <Feature
            icon={Activity}
            title="Real Time Triggers"
            desc="Monitor wallets, contracts, prices, and schedules on Ritual Chain."
          />
          <Feature
            icon={ShieldCheck}
            title="Onchain Sovereignty"
            desc="Your agent lives as a real contract at a real address. Fund it, stop it, restart it anytime."
          />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6">
        <div className="glass relative overflow-hidden rounded-3xl p-12 text-center neon-glow">
          <div className="absolute inset-0 grid-bg opacity-30" />
          <div className="relative">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Your first agent in <span className="text-gradient">minutes</span>.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              Connect a wallet, configure your agent, and watch it deploy onchain. No backend
              setup. No keys to manage. Just you and the chain.
            </p>
            <Button
              size="lg"
              onClick={launch}
              disabled={!ready}
              className="mt-8 bg-gradient-primary neon-glow text-primary-foreground hover:opacity-90"
            >
              <Wallet className="mr-2 h-5 w-5" />
              Connect wallet
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 text-sm text-muted-foreground sm:px-6">
          <span>© 2026 Ritual Agents</span>
          <div className="flex items-center gap-2">
            <Sparkles className="h-3 w-3" />
            <span className="text-xs">Ritual Testnet</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Feature({
  icon: Icon,
  title,
  desc,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
}) {
  return (
    <div className="glass group rounded-2xl p-6 transition-all hover:-translate-y-0.5 hover:neon-glow">
      <div className="mb-4 grid h-10 w-10 place-items-center rounded-lg bg-gradient-primary">
        <Icon className="h-5 w-5 text-primary-foreground" />
      </div>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}
