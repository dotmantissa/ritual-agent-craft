import { createMiddleware } from '@tanstack/react-start';
import { getPrivyToken } from './privy-token';

export const attachAuth = createMiddleware({ type: 'function' })
  .client(async ({ next }) => {
    const token = getPrivyToken();
    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  });
