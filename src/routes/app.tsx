import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { Header } from "@/components/layout/Header";
import { usePrivy } from "@privy-io/react-auth";
import { useEffect } from "react";
import { ensureUser } from "@/fns/users";
import { setPrivyToken } from "@/lib/privy-token";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const { ready, authenticated, user, getAccessToken } = usePrivy();
  const navigate = useNavigate();

  useEffect(() => {
    if (!ready) return;
    if (!authenticated) {
      navigate({ to: "/" });
      return;
    }
    // Sync token then register/update user in Neon
    getAccessToken().then(async (token) => {
      if (!token) return;
      setPrivyToken(token);
      const address = user?.wallet?.address ?? "";
      try {
        await ensureUser({ data: { walletAddress: address } });
      } catch (e) {
        console.error("ensureUser failed", e);
      }
    });
  }, [ready, authenticated]);

  if (!ready || !authenticated) {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="font-mono-tabular text-sm text-muted-foreground">
          <span className="animate-pulse-slow">Initializing agent runtime…</span>
        </div>
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
