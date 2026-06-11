/**
 * Faithful port of the desktop native auth client (omadia-ui
 * app/src/main/authApi.ts, issue #7) — the kernel's `/api/v1/auth/*` surface.
 * Electron-free by design, so it runs unchanged under React Native. The canvas
 * WebSocket upgrade requires an `omadia_session` cookie; we acquire it via the
 * password provider and pass it as the WS `Cookie` header. No embedded web view.
 */

export const SESSION_COOKIE = 'omadia_session';

export interface AuthProvider {
  id: string;
  displayName: string;
  kind: 'password' | 'oidc' | string;
}

export interface AuthDiscovery {
  providers: AuthProvider[];
  setupRequired: boolean;
}

/** ws(s)://host/omadia-ui/canvas → http(s)://host — the auth API lives on the
 *  same middleware origin as the canvas WS (path stripped, port preserved). */
export function httpOriginFromWs(wsUrl: string): string {
  const match = /^wss?:\/\/[^/]+/.exec(wsUrl.trim());
  if (!match) throw new Error(`invalid websocket url: ${wsUrl}`);
  return match[0].replace(/^ws/, 'http');
}

const isProvider = (p: unknown): p is AuthProvider => {
  if (typeof p !== 'object' || p === null) return false;
  const o = p as Record<string, unknown>;
  return typeof o['id'] === 'string' && typeof o['kind'] === 'string';
};

/** GET /api/v1/auth/providers — null means the endpoint is unreachable. */
export async function discoverProviders(origin: string): Promise<AuthDiscovery | null> {
  try {
    const res = await fetch(`${origin}/api/v1/auth/providers`);
    if (!res.ok) return null;
    const body = (await res.json()) as { providers?: unknown; setup_required?: unknown };
    if (!Array.isArray(body.providers)) return null;
    return {
      providers: body.providers.filter(isProvider),
      setupRequired: body.setup_required === true,
    };
  } catch {
    return null;
  }
}

/** Read the Set-Cookie header(s) across runtimes: undici/RN expose the
 *  `getSetCookie()` array; older fetch only the comma-joined `get()` string. */
function readSetCookie(headers: Headers): string[] {
  const withGetter = headers as Headers & { getSetCookie?: () => string[] };
  if (typeof withGetter.getSetCookie === 'function') {
    const arr = withGetter.getSetCookie();
    if (arr.length > 0) return arr;
  }
  const joined = headers.get('set-cookie');
  return joined ? joined.split(/,(?=[^ ;]+=)/) : [];
}

/** Pull `omadia_session=…` out of the Set-Cookie header(s). */
function sessionFromSetCookie(headers: Headers): string | null {
  for (const raw of readSetCookie(headers)) {
    const match = new RegExp(`${SESSION_COOKIE}=[^;,\\s]+`).exec(raw);
    if (match) return match[0];
  }
  return null;
}

/**
 * POST {email, password} to the password provider; return the
 * `omadia_session=…` cookie on success. Throws a user-facing message on failure.
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
    });
  } catch {
    throw new Error('Server nicht erreichbar.');
  }

  if (res.status === 404) throw new Error(`Unbekannter Provider: ${providerId}.`);
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

  const cookie = sessionFromSetCookie(res.headers);
  if (!cookie) throw new Error('Login ok, aber kein Session-Cookie erhalten.');
  return cookie;
}

export interface SessionCheck {
  valid: boolean;
  email?: string;
}

/** GET /api/v1/auth/me with the cookie. null = server unreachable (keep the
 *  cookie and let the WS upgrade decide rather than discard on a blip). */
export async function validateSession(origin: string, cookie: string): Promise<SessionCheck | null> {
  let res: Response;
  try {
    res = await fetch(`${origin}/api/v1/auth/me`, { headers: { Cookie: cookie } });
  } catch {
    return null;
  }
  if (!res.ok) return { valid: false };
  try {
    const body = (await res.json()) as { user?: { email?: unknown } };
    return {
      valid: true,
      ...(typeof body.user?.email === 'string' ? { email: body.user.email } : {}),
    };
  } catch {
    return { valid: true };
  }
}
