import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { Header } from "@/components/layout/Header";
import { useSession } from "@/hooks/use-session";
import { useEffect } from "react";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, loading } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/" });
    }
  }, [loading, user, navigate]);

  if (loading || !user) {
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
