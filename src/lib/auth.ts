import { supabase } from "@/integrations/supabase/client";
import {
  clearWallet,
  generateMockWallet,
  loadWallet,
  saveWallet,
  walletCredentials,
  type StoredWallet,
} from "./wallet";

export async function connectWallet(): Promise<StoredWallet> {
  let wallet = loadWallet();
  if (!wallet) {
    wallet = generateMockWallet();
    saveWallet(wallet);
  }
  const { email, password } = walletCredentials(wallet);

  // Try sign in; if no account, sign up.
  const signIn = await supabase.auth.signInWithPassword({ email, password });
  if (signIn.error) {
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { wallet_address: wallet.address, display_name: `Operator ${wallet.address.slice(2, 6)}` },
      },
    });
    if (signUpError) throw signUpError;
    // Sign in after signup (auto-confirm is on)
    const after = await supabase.auth.signInWithPassword({ email, password });
    if (after.error) throw after.error;
  }

  return wallet;
}

export async function disconnectWallet(): Promise<void> {
  await supabase.auth.signOut();
  clearWallet();
}
