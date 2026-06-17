import { Outlet, createRootRoute, HeadContent, Scripts, Link } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { PrivyProvider } from "@privy-io/react-auth";
import { usePrivy } from "@privy-io/react-auth";
import { useEffect } from "react";
import { setPrivyToken } from "@/lib/privy-token";
import { defineChain } from "viem";
import appCss from "../styles.css?url";

const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID as string;

export const ritualTestnet = defineChain({
  id: 1979,
  name: "Ritual Testnet",
  nativeCurrency: { name: "Ritual", symbol: "RITUAL", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.ritualfoundation.org"] },
  },
  blockExplorers: {
    default: { name: "Ritual Explorer", url: "https://explorer.ritualfoundation.org" },
  },
  testnet: true,
});

function PrivyTokenSync() {
  const { ready, authenticated, getAccessToken } = usePrivy();
  useEffect(() => {
    if (!ready) return;
    if (!authenticated) {
      setPrivyToken(null);
      return;
    }
    let cancelled = false;
    const sync = async () => {
      const t = await getAccessToken();
      if (!cancelled) setPrivyToken(t);
    };
    sync();
    const interval = setInterval(sync, 25 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [ready, authenticated, getAccessToken]);
  return null;
}

function NotFoundComponent() {
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="glass max-w-md rounded-2xl p-8 text-center">
        <h1 className="text-7xl font-bold text-gradient">404</h1>
        <h2 className="mt-2 text-xl font-semibold">Signal lost</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          That route doesn't exist on the Ritual network.
        </p>
        <Link
          to="/app"
          className="mt-6 inline-flex items-center justify-center rounded-md bg-gradient-primary px-4 py-2 text-sm font-medium text-primary-foreground neon-glow"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Ritual Agents — Autonomous AI agents on Ritual" },
      { name: "description", content: "Build, deploy, and monetize AI-powered onchain agents." },
      { property: "og:title", content: "Ritual Agents" },
      { property: "og:description", content: "Build AI-powered agents that monitor, decide, and execute onchain." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootComponent() {
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ["wallet"],
        defaultChain: ritualTestnet,
        supportedChains: [ritualTestnet],
        appearance: {
          theme: "dark",
          accentColor: "#7c3aed",
        },
        embeddedWallets: {
          createOnLogin: "users-without-wallets",
          showWalletUIs: true,
        },
      }}
    >
      <PrivyTokenSync />
      <Outlet />
    </PrivyProvider>
  );
}

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Toaster />
        <Scripts />
      </body>
    </html>
  );
}
