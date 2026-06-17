import { usePrivy } from '@privy-io/react-auth';

export type AppUser = {
  id: string;
  address: string | null;
  display_name: string;
};

export function useSession() {
  const { ready, authenticated, user } = usePrivy();
  const appUser: AppUser | null =
    authenticated && user
      ? {
          id: user.id,
          address: user.wallet?.address ?? null,
          display_name: '',
        }
      : null;
  return { user: appUser, loading: !ready };
}
