// Lightweight auth — file-backed user store + signed cookie sessions.
// No external deps, no DB. Suitable for demo / single-tenant deployments.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export type UserRole = 'qa_leader' | 'qc_analyst' | 'tester';

export interface User {
  username: string;
  password: string;       // plain (demo only — see warning below)
  name: string;
  role: UserRole;
  email: string;
  initials: string;
  color: string;
}

export interface Session {
  username: string;
  name: string;
  role: UserRole;
  initials: string;
  color: string;
  iat: number;
  exp: number;
}

// ---------- Persistent storage ----------
const DATA_DIR = path.join(process.cwd(), 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

const SEED_USERS: User[] = [
  {
    username: 'leader',
    password: 'leader123',
    name: 'Sarah Wijaya',
    role: 'qa_leader',
    email: 'sarah.wijaya@qaqc4bi.local',
    initials: 'SW',
    color: '#8a3ffc',
  },
  {
    username: 'qc',
    password: 'qc123',
    name: 'Budi Santoso',
    role: 'qc_analyst',
    email: 'budi.santoso@qaqc4bi.local',
    initials: 'BS',
    color: '#0f62fe',
  },
  {
    username: 'tester',
    password: 'test123',
    name: 'Diana Putri',
    role: 'tester',
    email: 'diana.putri@qaqc4bi.local',
    initials: 'DP',
    color: '#198038',
  },
];

function ensureSeed(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(SEED_USERS, null, 2), 'utf-8');
  }
}

export function listUsers(): User[] {
  ensureSeed();
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8')) as User[];
  } catch {
    return SEED_USERS;
  }
}

export function findUser(username: string, password: string): User | null {
  const users = listUsers();
  const u = users.find(x => x.username.toLowerCase() === username.toLowerCase());
  if (!u || u.password !== password) return null;
  return u;
}

// ---------- Signed cookie session ----------
// HMAC over the JSON payload with a secret. No external lib needed.

const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 hours
export const SESSION_COOKIE = 'qaqc_session';

function getSecret(): string {
  return process.env.AUTH_SECRET || 'qaqc4bi-demo-secret-change-me';
}

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString('base64url');
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', getSecret()).update(payload).digest('base64url');
}

export function createSessionCookie(user: User): { value: string; maxAge: number } {
  const now = Math.floor(Date.now() / 1000);
  const session: Session = {
    username: user.username,
    name: user.name,
    role: user.role,
    initials: user.initials,
    color: user.color,
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
  };
  const payload = b64url(JSON.stringify(session));
  const sig = sign(payload);
  return { value: `${payload}.${sig}`, maxAge: SESSION_TTL_SECONDS };
}

export function verifySessionCookie(raw: string | undefined | null): Session | null {
  if (!raw) return null;
  const [payload, sig] = raw.split('.');
  if (!payload || !sig) return null;
  if (sign(payload) !== sig) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')) as Session;
    if (session.exp < Math.floor(Date.now() / 1000)) return null;
    return session;
  } catch {
    return null;
  }
}

// Human-friendly role labels
export const ROLE_LABEL: Record<UserRole, string> = {
  qa_leader: 'QA Leader',
  qc_analyst: 'QC Analyst',
  tester: 'Tester',
};
