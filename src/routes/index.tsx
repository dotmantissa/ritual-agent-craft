import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Sparkles, Zap, Brain, Activity, ShieldCheck, Code2, Wallet } from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";
import { useEffect } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ritual Agents — Autonomous AI agents on Ritual" },
      { name: "description", content: "Build, deploy, and monetize AI-powered onchain agents." },
      { property: "og:title", content: "Ritual Agents" },
      { property: "og:description", content: "Build AI-powered agents that monitor, decide, and execute onchain." },
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
              Now live on Ritual testnet (mock)
            </div>
            <h1 className="mt-6 text-balance text-5xl font-bold tracking-tight sm:text-7xl">
              Autonomous <span className="text-gradient">AI agents</span>
              <br />
              that act onchain.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted-foreground">
              Build no-code agents that monitor wallets, react to events, and execute transactions
              on Ritual — powered by AI decision-making.
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

          <div className="mx-auto mt-20 grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Active agents" value="2,481" />
            <Stat label="Actions / 24h" value="18.2k" />
            <Stat label="AI decisions" value="9.4k" />
            <Stat label="Success rate" value="98.1%" />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            One platform. Every <span className="text-gradient">automation</span>.
          </h2>
          <p className="mt-4 text-muted-foreground">
            From sentiment-based trading to whale alerts, anomaly detection, and DCA — agents do
            the work while you sleep.
          </p>
        </div>

        <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Feature icon={Zap} title="No-code Builder" desc="IF this → THEN that. Pick a trigger, write a prompt, choose an action. Deploy in seconds." />
          <Feature icon={Brain} title="AI Decision Layer" desc="Every event is evaluated by an LLM against your custom policy. Smart agents, not blind bots." />
          <Feature icon={Activity} title="Real-time Triggers" desc="Monitor wallets, contracts, prices, and schedules. Sub-second reaction times." />
          <Feature icon={ShieldCheck} title="Mock Execution" desc="Test agent logic safely against simulated chain events before going live." />
          <Feature icon={Sparkles} title="Marketplace" desc="Fork battle-tested templates from the community. Monetize your own strategies." />
          <Feature icon={Code2} title="Developer Mode" desc="Edit raw JSON specs. SDK and webhook triggers coming soon." />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6">
        <div className="glass relative overflow-hidden rounded-3xl p-12 text-center neon-glow">
          <div className="absolute inset-0 grid-bg opacity-30" />
          <div className="relative">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Your first agent in <span className="text-gradient">60 seconds</span>.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              Connect a wallet, fork a template, watch it run. No installs. No keys. No setup.
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
          <span className="font-mono-tabular text-xs">v0.1.0 · testnet-mock</span>
        </div>
      </footer>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass rounded-xl px-4 py-5 text-center">
      <div className="font-mono-tabular text-2xl font-semibold text-gradient">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function Feature({ icon: Icon, title, desc }: { icon: React.ComponentType<{ className?: string }>; title: string; desc: string }) {
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
