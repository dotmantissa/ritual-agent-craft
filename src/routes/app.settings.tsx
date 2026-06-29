import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { updateProfile } from "@/fns/users";
import { getPrivyToken } from "@/lib/privy-token";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { User, ExternalLink } from "lucide-react";
import { shortAddress } from "@/lib/wallet";
import { RITUAL_EXPLORER } from "@/lib/ritualDeploy";

function authHdr(): Record<string, string> {
  const t = getPrivyToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export const Route = createFileRoute("/app/settings")({
  head: () => ({
    meta: [
      { title: "Settings | Ritual Agents" },
      { name: "description", content: "Manage your profile and wallet." },
    ],
  }),
  component: Settings,
});

function Settings() {
  const { user } = usePrivy();
  const wallet = user?.wallet?.address ?? null;
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);

  const saveProfile = async () => {
    if (!displayName.trim()) { toast.error("Enter a display name"); return; }
    setSaving(true);
    try {
      await updateProfile({ data: { displayName }, headers: authHdr() });
      toast.success("Profile updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your profile and connected wallet.
        </p>
      </div>

      <div className="glass rounded-2xl p-6">
        <div className="mb-5 flex items-center gap-2">
          <User className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-semibold uppercase tracking-wider">Profile</h2>
        </div>
        <div className="space-y-4">
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
                Wallet
              </Label>
              <div className="mt-1.5 flex items-center gap-2 rounded-md border border-border bg-card/40 px-3 py-2">
                <span className="flex-1 font-mono text-sm text-muted-foreground">
                  {shortAddress(wallet)}
                </span>
                {wallet && (
                  <a
                    href={`${RITUAL_EXPLORER}/address/${wallet}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:text-accent/80"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
                <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-success">
                  connected
                </span>
              </div>
            </div>
          </div>
          <Button
            onClick={saveProfile}
            disabled={saving}
            className="bg-gradient-primary text-primary-foreground neon-glow hover:opacity-90"
          >
            {saving ? "Saving..." : "Save profile"}
          </Button>
        </div>
      </div>

      <div className="glass rounded-2xl p-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Network
        </h2>
        <div className="grid gap-2 rounded-lg border border-border bg-card/30 px-4 py-3 font-mono text-xs text-muted-foreground">
          <div className="flex justify-between">
            <span>Chain ID</span>
            <span className="text-foreground">1979</span>
          </div>
          <div className="flex justify-between">
            <span>Network</span>
            <span className="text-foreground">Ritual Testnet</span>
          </div>
          <div className="flex justify-between">
            <span>RPC</span>
            <span className="text-foreground">rpc.ritualfoundation.org</span>
          </div>
          <div className="flex justify-between">
            <span>Factory</span>
            <a
              href={`${RITUAL_EXPLORER}/address/0x9dC4C054e53bCc4Ce0A0Ff09E890A7a8e817f304`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              0x9dC4C054...f304
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
