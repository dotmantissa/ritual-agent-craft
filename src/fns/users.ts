import { createServerFn } from '@tanstack/react-start';
import { requireAuth } from '@/lib/auth-middleware';
import { getDb } from '@/lib/db';
import { z } from 'zod';

export type UserProfile = {
  id: string;
  wallet_address: string;
  display_name: string;
};

export const ensureUser = createServerFn({ method: 'POST' })
  .middleware([requireAuth])
  .inputValidator((input: unknown) =>
    z.object({ walletAddress: z.string() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<UserProfile> => {
    const sql = getDb();
    const { userId } = context;
    const rows = await sql`
      INSERT INTO users (id, wallet_address, display_name)
      VALUES (${userId}, ${data.walletAddress}, ${'Operator ' + data.walletAddress.slice(2, 6)})
      ON CONFLICT (id) DO UPDATE SET wallet_address = EXCLUDED.wallet_address
      RETURNING id, wallet_address, display_name
    `;
    return rows[0] as UserProfile;
  });

export const updateProfile = createServerFn({ method: 'POST' })
  .middleware([requireAuth])
  .inputValidator((input: unknown) =>
    z.object({ displayName: z.string().max(80) }).parse(input),
  )
  .handler(async ({ data, context }): Promise<UserProfile> => {
    const sql = getDb();
    const rows = await sql`
      UPDATE users SET display_name = ${data.displayName}
      WHERE id = ${context.userId}
      RETURNING id, wallet_address, display_name
    `;
    if (!rows.length) throw new Error('User not found');
    return rows[0] as UserProfile;
  });
