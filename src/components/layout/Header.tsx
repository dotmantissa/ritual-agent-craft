import { Link, useNavigate, useLocation } from "@tanstack/react-router";
import { usePrivy } from "@privy-io/react-auth";
import { shortAddress } from "@/lib/wallet";
import { Button } from "@/components/ui/button";
import { Sparkles, LogOut, Wallet, Settings } from "lucide-react";
import { useState } from "react";

export function Header() {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const navigate = useNavigate();
  const location = useLocation();
  const [busy, setBusy] = useState(false);
  const walletAddress = user?.wallet?.address ?? null;

  const onConnect = async () => {
    setBusy(true);
    try {
      await login();
      if (location.pathname === "/") navigate({ to: "/app" });
    } finally {
      setBusy(false);
    }
  };

  const onDisconnect = async () => {
    await logout();
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
          {authenticated && (
            <>
              <NavLink to="/app" exact>Dashboard</NavLink>
              <NavLink to="/app/builder">Builder</NavLink>
              <NavLink to="/app/marketplace">Marketplace</NavLink>
            </>
          )}
        </nav>
        <div className="flex items-center gap-2">
          {authenticated ? (
            <>
              <div className="hidden items-center gap-2 rounded-full border border-border bg-card/40 px-3 py-1.5 sm:flex">
                <span className="h-2 w-2 animate-pulse-slow rounded-full bg-success" />
                <span className="font-mono-tabular text-xs text-muted-foreground">
                  {shortAddress(walletAddress)}
                </span>
              </div>
              <Button variant="ghost" size="icon" asChild aria-label="Settings">
                <Link to="/app/settings"><Settings className="h-4 w-4" /></Link>
              </Button>
              <Button variant="ghost" size="icon" onClick={onDisconnect} aria-label="Disconnect">
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Button
              onClick={onConnect}
              disabled={!ready || busy}
              className="bg-gradient-primary neon-glow text-primary-foreground hover:opacity-90"
            >
              <Wallet className="mr-2 h-4 w-4" />
              {busy ? "Connecting…" : "Connect Wallet"}
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

function NavLink({ to, children, exact }: { to: string; children: React.ReactNode; exact?: boolean }) {
  return (
    <Link
      to={to}
      activeOptions={exact ? { exact: true } : undefined}
      className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground"
      activeProps={{ className: "rounded-md px-3 py-1.5 text-sm text-foreground bg-accent/10" }}
    >
      {children}
    </Link>
  );
}
