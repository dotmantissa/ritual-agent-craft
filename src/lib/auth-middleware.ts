import { createMiddleware } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { PrivyClient } from '@privy-io/node';

const PRIVY_APP_ID = process.env.PRIVY_APP_ID ?? 'cmqhlqq1i00d70cjj9yqbva1w';
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET ?? '';

let _client: PrivyClient | undefined;
function getClient() {
  if (!_client) {
    _client = new PrivyClient({ appId: PRIVY_APP_ID, appSecret: PRIVY_APP_SECRET });
  }
  return _client;
}

export const requireAuth = createMiddleware({ type: 'function' })
  .server(async ({ next }) => {
    const request = getRequest();
    const authHeader = request?.headers?.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      throw Object.assign(new Error('Unauthorized'), { status: 401 });
    }
    const token = authHeader.slice(7);
    try {
      const { user_id: userId } = await getClient().utils().auth().verifyAccessToken(token);
      return next({ context: { userId } });
    } catch (err) {
      console.error('JWT verify failed', err instanceof Error ? err.message : String(err));
      throw Object.assign(new Error('Unauthorized: Invalid token'), { status: 401 });
    }
  });
