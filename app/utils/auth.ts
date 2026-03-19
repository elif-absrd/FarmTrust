export type UserRole = 'farmer' | 'provider' | 'admin';

export interface User {
  id: string;
  username: string;
  password: string;
  name: string;
  role: UserRole;
  email: string;
}

export interface TokenPayload {
  sub: string;
  username: string;
  name: string;
  role: UserRole;
  email: string;
  iat: number;
  exp: number;
}

const JWT_SECRET = 'farmtrust-secret-key-2026';
const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

// ─── Test Users ───────────────────────────────────────────────────────────────
export const TEST_USERS: Omit<User, never>[] = [
  {
    id: '1',
    username: 'farmer1',
    password: 'farmer123',
    name: 'Vinay',
    role: 'farmer',
    email: 'vinay@farmtrust.com',
  },
  {
    id: '2',
    username: 'provider1',
    password: 'provider123',
    name: 'AgriVet Clinic',
    role: 'provider',
    email: 'agrivet@farmtrust.com',
  },
  {
    id: '3',
    username: 'admin',
    password: 'admin123',
    name: 'Admin User',
    role: 'admin',
    email: 'admin@farmtrust.com',
  },
];

// ─── Base64 URL helpers ────────────────────────────────────────────────────────
function b64UrlEncode(str: string): string {
  // btoa is available in React Native (Hermes)
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function b64UrlDecode(str: string): string {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4;
  const repadded = pad ? padded + '==='.slice(0, 4 - pad) : padded;
  return decodeURIComponent(escape(atob(repadded)));
}

// ─── Simple deterministic signature (for demo/test purposes) ──────────────────
function sign(data: string): string {
  const input = data + JWT_SECRET;
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
    h >>>= 0;
  }
  return h.toString(36);
}

// ─── Public API ───────────────────────────────────────────────────────────────
export function createToken(user: Omit<User, 'password'>): string {
  const header = b64UrlEncode(JSON.stringify({ alg: 'FNV1a', typ: 'JWT' }));
  const now = Date.now();
  const payload: TokenPayload = {
    sub: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    email: user.email,
    iat: now,
    exp: now + TOKEN_EXPIRY_MS,
  };
  const encodedPayload = b64UrlEncode(JSON.stringify(payload));
  const signature = sign(`${header}.${encodedPayload}`);
  return `${header}.${encodedPayload}.${signature}`;
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, encodedPayload, signature] = parts;

    if (sign(`${header}.${encodedPayload}`) !== signature) return null;

    const payload: TokenPayload = JSON.parse(b64UrlDecode(encodedPayload));

    if (Date.now() > payload.exp) return null;

    return payload;
  } catch {
    return null;
  }
}

export function authenticate(username: string, password: string): string | null {
  const user = TEST_USERS.find(
    (u) => u.username === username && u.password === password,
  );
  if (!user) return null;
  const { password: _pwd, ...rest } = user;
  return createToken(rest);
}
