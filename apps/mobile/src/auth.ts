/**
 * Native password login against the Omadia middleware auth surface
 * (`/api/v1/auth/*`, see omadia-ui issue #7). The canvas WebSocket upgrade
 * requires an `omadia_session` cookie; we acquire it via the password provider
 * and pass it as the WS `Cookie` header. No embedded web-view, no popup.
 */

export interface AuthProvider {
  id: string;
  displayName: string;
  kind: 'password' | 'oidc' | string;
}

/** Derive the http(s) origin from a ws(s):// canvas URL — path stripped. */
export function httpOriginFromWs(wsUrl: string): string {
  const match = /^wss?:\/\/[^/]+/.exec(wsUrl.trim());
  if (!match) throw new Error(`invalid websocket url: ${wsUrl}`);
  return match[0].replace(/^ws/, 'http');
}

/** GET the provider catalogue; null when the endpoint is unreachable. */
export async function fetchProviders(origin: string): Promise<AuthProvider[] | null> {
  try {
    const res = await fetch(`${origin}/api/v1/auth/providers`);
    if (!res.ok) return null;
    const body = (await res.json()) as { providers?: unknown };
    if (!Array.isArray(body.providers)) return null;
    return body.providers.filter(
      (p): p is AuthProvider =>
        typeof p === 'object' &&
        p !== null &&
        typeof (p as AuthProvider).id === 'string' &&
        typeof (p as AuthProvider).kind === 'string',
    );
  } catch {
    return null;
  }
}

/**
 * POST {email, password} to the password provider; return the
 * `omadia_session=…` cookie string on success. Throws a user-facing message
 * on failure.
 */
export async function loginWithPassword(
  origin: string,
  providerId: string,
  email: string,
  password: string,
): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${origin}/api/v1/auth/login/${encodeURIComponent(providerId)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
    });
  } catch {
    throw new Error('Server nicht erreichbar.');
  }

  if (!res.ok) {
    let code = `${res.status}`;
    try {
      const body = (await res.json()) as { code?: unknown };
      if (typeof body.code === 'string') code = body.code;
    } catch {
      // body not JSON — keep the status code
    }
    throw new Error(
      code === 'auth.invalid_credentials'
        ? 'Falsche E-Mail oder falsches Passwort.'
        : `Login fehlgeschlagen (${code}).`,
    );
  }

  // RN exposes Set-Cookie via headers.get; multiple cookies are comma-joined,
  // so stop the match at ',', ';' or whitespace.
  const raw = res.headers.get('set-cookie') ?? '';
  const match = /omadia_session=[^;,\s]+/.exec(raw);
  if (!match) throw new Error('Login ok, aber kein Session-Cookie erhalten.');
  return match[0];
}
