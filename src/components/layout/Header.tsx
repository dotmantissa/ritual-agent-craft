import { Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useSession } from "@/hooks/use-session";
import { connectWallet, disconnectWallet } from "@/lib/auth";
import { shortAddress } from "@/lib/wallet";
import { Button } from "@/components/ui/button";
import { Sparkles, LogOut, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export function Header() {
  const { user } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [busy, setBusy] = useState(false);
  const wallet = (user?.user_metadata?.wallet_address as string | undefined) ?? null;

  const onConnect = async () => {
    setBusy(true);
    try {
      await connectWallet();
      toast.success("Wallet connected");
      if (location.pathname === "/") navigate({ to: "/app" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to connect");
    } finally {
      setBusy(false);
    }
  };

  const onDisconnect = async () => {
    await disconnectWallet();
    navigate({ to: "/" });
  };

  return (
    <header className="sticky top-0 z-50 glass-strong">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-primary neon-glow">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-semibold tracking-tight">
            Ritual<span className="text-gradient">Agents</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {user && (
            <>
              <NavLink to="/app">Dashboard</NavLink>
              <NavLink to="/app/builder">Builder</NavLink>
              <NavLink to="/app/marketplace">Marketplace</NavLink>
            </>
          )}
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <div className="hidden items-center gap-2 rounded-full border border-border bg-card/40 px-3 py-1.5 sm:flex">
                <span className="h-2 w-2 animate-pulse-slow rounded-full bg-success" />
                <span className="font-mono-tabular text-xs text-muted-foreground">
                  {shortAddress(wallet)}
                </span>
              </div>
              <Button variant="ghost" size="icon" onClick={onDisconnect} aria-label="Disconnect">
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Button onClick={onConnect} disabled={busy} className="bg-gradient-primary neon-glow text-primary-foreground hover:opacity-90">
              <Wallet className="mr-2 h-4 w-4" />
              {busy ? "Connecting…" : "Connect Wallet"}
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground"
      activeProps={{ className: "rounded-md px-3 py-1.5 text-sm text-foreground bg-accent/10" }}
    >
      {children}
    </Link>
  );
}
