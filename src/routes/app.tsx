import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { Header } from "@/components/layout/Header";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useEffect, useState } from "react";
import { ensureUser } from "@/fns/users";
import { setPrivyToken } from "@/lib/privy-token";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";

const RITUAL_CHAIN_ID = 1979;
const parseChainId = (id: string | number): number =>
  typeof id === "number" ? id : parseInt((id as string).replace("eip155:", ""), 10);

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const { ready, authenticated, user, getAccessToken } = usePrivy();
  const { wallets } = useWallets();
  const navigate = useNavigate();
  const [tokenReady, setTokenReady] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!authenticated) {
      navigate({ to: "/" });
      return;
    }
    getAccessToken().then(async (token) => {
      if (!token) return;
      setPrivyToken(token);
      setTokenReady(true);
      const address = user?.wallet?.address ?? "";
      try {
        await ensureUser({ data: { walletAddress: address } });
      } catch (e) {
        console.error("ensureUser failed", e);
      }
    });
  }, [ready, authenticated]);

  // Spinner while Privy initialises or JWT is being fetched
  if (!ready || !authenticated || !tokenReady) {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="font-mono-tabular text-sm text-muted-foreground">
          <span className="animate-pulse-slow">Initializing agent runtime…</span>
        </div>
      </div>
    );
  }

  // Enforce Ritual Testnet on every connected wallet
  const wrongNetwork = wallets.length > 0 && wallets.some((w) => parseChainId(w.chainId) !== RITUAL_CHAIN_ID);
  if (wrongNetwork) {
    return (
      <div className="min-h-screen">
        <Header />
        <WrongNetworkGate wallets={wallets} />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}

function WrongNetworkGate({ wallets }: { wallets: ReturnType<typeof useWallets>["wallets"] }) {
  const [switching, setSwitching] = useState(false);

  const switchAll = async () => {
    setSwitching(true);
    try {
      await Promise.all(
        wallets
          .filter((w) => parseChainId(w.chainId) !== RITUAL_CHAIN_ID)
          .map((w) => w.switchChain(RITUAL_CHAIN_ID)),
      );
      toast.success("Switched to Ritual Testnet");
    } catch {
      toast.error(
        "Could not auto-switch. Add Ritual Testnet manually: Chain ID 1979, RPC https://rpc.ritualfoundation.org",
      );
    } finally {
      setSwitching(false);
    }
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="glass mx-auto mt-16 max-w-lg rounded-2xl p-10 text-center">
        <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl border border-warning/40 bg-warning/10">
          <AlertTriangle className="h-7 w-7 text-warning" />
        </div>
        <h2 className="text-xl font-semibold">Wrong Network</h2>
        <p className="mx-auto mt-3 max-w-sm text-sm text-muted-foreground">
          Ritual Agents only runs on <span className="font-medium text-foreground">Ritual Testnet</span> (Chain ID&nbsp;1979).
          Switch your wallet to continue.
        </p>
        <div className="mt-4 rounded-lg border border-border bg-card/30 px-4 py-3 text-left text-xs font-mono-tabular text-muted-foreground space-y-1">
          <div><span className="text-foreground/60">Chain ID:</span> 1979</div>
          <div><span className="text-foreground/60">RPC:</span> https://rpc.ritualfoundation.org</div>
          <div><span className="text-foreground/60">Symbol:</span> RITUAL</div>
          <div><span className="text-foreground/60">Explorer:</span> https://explorer.ritualfoundation.org</div>
        </div>
        <Button
          onClick={switchAll}
          disabled={switching}
          className="mt-6 w-full bg-gradient-primary text-primary-foreground neon-glow hover:opacity-90"
        >
          {switching ? "Switching…" : "Switch to Ritual Testnet"}
        </Button>
      </div>
    </main>
  );
}
