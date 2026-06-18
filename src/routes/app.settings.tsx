import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { updateProfile } from "@/fns/users";
import { getPrivyToken } from "@/lib/privy-token";

function authHdr(): Record<string, string> {
  const t = getPrivyToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff, Key, User, Moon, Sun } from "lucide-react";
import { shortAddress } from "@/lib/wallet";

export const Route = createFileRoute("/app/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Ritual Agents" },
      { name: "description", content: "Manage your API keys and preferences." },
    ],
  }),
  component: Settings,
});

function Settings() {
  const { user } = usePrivy();
  const wallet = user?.wallet?.address ?? null;
  const [displayName, setDisplayName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [showKey, setShowKey] = useState(false);
  const apiKeyPlaceholder = "sk-…stored server-side only";

  const [dark, setDark] = useState(() =>
    typeof document !== "undefined"
      ? document.documentElement.classList.contains("dark")
      : true,
  );

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    if (next) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    try {
      localStorage.setItem("ritual.theme", next ? "dark" : "light");
    } catch {
      // ignore
    }
  };

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      await updateProfile({ data: { displayName }, headers: authHdr() });
      toast.success("Profile updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your profile, API keys, and display preferences.
        </p>
      </div>

      <Section icon={User} title="Profile">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Display name
            </Label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Agent Operator"
              className="mt-1.5 bg-card/40"
            />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Wallet address
            </Label>
            <div className="mt-1.5 flex items-center gap-2 rounded-md border border-border bg-card/40 px-3 py-2">
              <span className="font-mono-tabular text-sm text-muted-foreground">
                {shortAddress(wallet)}
              </span>
              <span className="ml-auto rounded-full bg-success/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-success">
                connected
              </span>
            </div>
          </div>
        </div>
        <Button
          onClick={saveProfile}
          disabled={savingProfile}
          className="bg-gradient-primary text-primary-foreground neon-glow hover:opacity-90"
        >
          {savingProfile ? "Saving…" : "Save profile"}
        </Button>
      </Section>

      <Section icon={Key} title="API Keys">
        <p className="text-sm text-muted-foreground">
          The AI decision engine uses the{" "}
          <code className="rounded bg-card/60 px-1 text-xs">LOVABLE_API_KEY</code> environment
          variable set on the server. To rotate it, update the variable in your deployment
          environment (Vercel / Cloudflare Workers) and redeploy.
        </p>
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            LOVABLE_API_KEY
          </Label>
          <div className="relative mt-1.5">
            <Input
              type={showKey ? "text" : "password"}
              value={apiKeyPlaceholder}
              readOnly
              className="bg-card/40 pr-10 font-mono-tabular text-xs text-muted-foreground"
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Rate limit: 50 AI calls per user per hour (cost guard).
          </p>
        </div>
      </Section>

      <Section icon={dark ? Moon : Sun} title="Appearance">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">Theme</div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Currently: <span className="capitalize">{dark ? "dark" : "light"}</span>
            </p>
          </div>
          <Button
            variant="outline"
            onClick={toggleTheme}
            className="border-border bg-card/40"
          >
            {dark ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
            Switch to {dark ? "light" : "dark"}
          </Button>
        </div>
      </Section>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="glass rounded-2xl p-6">
      <div className="mb-5 flex items-center gap-2">
        <Icon className="h-4 w-4 text-accent" />
        <h2 className="text-sm font-semibold uppercase tracking-wider">{title}</h2>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}
