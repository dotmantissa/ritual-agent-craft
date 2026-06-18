import { createMiddleware } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const PRIVY_APP_ID = process.env.PRIVY_APP_ID ?? 'cmqhlqq1i00d70cjj9yqbva1w';

let _jwks: ReturnType<typeof createRemoteJWKSet> | undefined;
function getJwks() {
  if (!_jwks) {
    _jwks = createRemoteJWKSet(new URL('https://auth.privy.io/api/v1/jwks.json'));
  }
  return _jwks;
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
      const { payload } = await jwtVerify(token, getJwks(), {
        issuer: 'privy.io',
        audience: PRIVY_APP_ID,
      });
      const userId = payload.sub as string;
      return next({ context: { userId } });
    } catch (err) {
      console.error('JWT verify failed', {
        message: err instanceof Error ? err.message : String(err),
        configuredAudience: PRIVY_APP_ID,
        usingDefaultAudience: !process.env.PRIVY_APP_ID,
      });
      throw Object.assign(new Error('Unauthorized: Invalid token'), { status: 401 });
    }
  });
