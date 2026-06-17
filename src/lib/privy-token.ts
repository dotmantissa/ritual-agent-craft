// Module-level token cache — set by PrivyTokenSync, read by auth-attacher
let _token: string | null = null;

export function setPrivyToken(t: string | null) { _token = t; }
export function getPrivyToken(): string | null { return _token; }
