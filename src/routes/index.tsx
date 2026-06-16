import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sparkles,
  Zap,
  Brain,
  Activity,
  ShieldCheck,
  Code2,
  Wallet,
  Mail,
  Lock,
} from "lucide-react";
import { useState } from "react";
import { connectWallet } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ritual Agents — Autonomous AI agents on Ritual" },
      {
        name: "description",
        content:
          "Build, deploy, and monetize AI-powered onchain agents. The default automation layer for Ritual.",
      },
      { property: "og:title", content: "Ritual Agents" },
      {
        property: "og:description",
        content: "Build AI-powered agents that monitor, decide, and execute onchain.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailMode, setEmailMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);

  const launch = async () => {
    setBusy(true);
    try {
      await connectWallet();
      navigate({ to: "/app" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to connect");
    } finally {
      setBusy(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error("Email and password are required");
      return;
    }
    setEmailBusy(true);
    try {
      if (emailMode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        toast.success("Account created — check your email to confirm, then sign in.");
        setEmailMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/app" });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Auth failed");
    } finally {
      setEmailBusy(false);
    }
  };

  const handleGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/app` },
    });
    if (error) toast.error(error.message);
  };

  return (
    <div className="min-h-screen">
      <Header />

      {/* Hero */}
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
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button
                size="lg"
                onClick={launch}
                disabled={busy}
                className="bg-gradient-primary neon-glow text-primary-foreground hover:opacity-90"
              >
                <Wallet className="mr-2 h-5 w-5" />
                {busy ? "Connecting…" : "Launch app"}
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-border bg-card/40"
                onClick={() => setShowEmailForm((v) => !v)}
              >
                <Mail className="mr-2 h-4 w-4" />
                Sign in with email
              </Button>
            </div>

            {showEmailForm && (
              <div className="mx-auto mt-6 w-full max-w-sm glass rounded-2xl p-6 text-left">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-semibold">
                    {emailMode === "signin" ? "Sign in" : "Create account"}
                  </h3>
                  <div className="flex text-xs">
                    <button
                      onClick={() => setEmailMode("signin")}
                      className={`px-2 py-0.5 rounded-l border border-border ${emailMode === "signin" ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      Sign in
                    </button>
                    <button
                      onClick={() => setEmailMode("signup")}
                      className={`px-2 py-0.5 rounded-r border-t border-b border-r border-border ${emailMode === "signup" ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      Sign up
                    </button>
                  </div>
                </div>
                <form onSubmit={handleEmailAuth} className="space-y-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Email</Label>
                    <div className="relative mt-1">
                      <Mail className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="pl-8 bg-card/40"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Password</Label>
                    <div className="relative mt-1">
                      <Lock className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                      <Input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="pl-8 bg-card/40"
                        required
                        minLength={6}
                      />
                    </div>
                  </div>
                  <Button
                    type="submit"
                    disabled={emailBusy}
                    className="w-full bg-gradient-primary text-primary-foreground neon-glow hover:opacity-90"
                  >
                    {emailBusy ? "Please wait…" : emailMode === "signin" ? "Sign in" : "Create account"}
                  </Button>
                </form>
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-card/40 px-2 text-muted-foreground">or</span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="w-full border-border bg-card/40"
                  onClick={handleGoogle}
                >
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Continue with Google
                </Button>
              </div>
            )}
          </div>

          {/* Floating stats */}
          <div className="mx-auto mt-20 grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Active agents" value="2,481" />
            <Stat label="Actions / 24h" value="18.2k" />
            <Stat label="AI decisions" value="9.4k" />
            <Stat label="Success rate" value="98.1%" />
          </div>
        </div>
      </section>

      {/* Features */}
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
          <Feature
            icon={Zap}
            title="No-code Builder"
            desc="IF this → THEN that. Pick a trigger, write a prompt, choose an action. Deploy in seconds."
          />
          <Feature
            icon={Brain}
            title="AI Decision Layer"
            desc="Every event is evaluated by an LLM against your custom policy. Smart agents, not blind bots."
          />
          <Feature
            icon={Activity}
            title="Real-time Triggers"
            desc="Monitor wallets, contracts, prices, and schedules. Sub-second reaction times."
          />
          <Feature
            icon={ShieldCheck}
            title="Mock Execution"
            desc="Test agent logic safely against simulated chain events before going live."
          />
          <Feature
            icon={Sparkles}
            title="Marketplace"
            desc="Fork battle-tested templates from the community. Monetize your own strategies."
          />
          <Feature
            icon={Code2}
            title="Developer Mode"
            desc="Edit raw JSON specs. SDK and webhook triggers coming soon."
          />
        </div>
      </section>

      {/* CTA */}
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
              disabled={busy}
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
