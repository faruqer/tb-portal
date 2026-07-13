import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { getModels } from '@/lib/mongodb';
import type { SessionPayload } from './types';

const COOKIE_NAME = 'rm_session';
const SESSION_TTL = 60 * 60 * 8;

function getSecret() {
  const secret = process.env.JWT_SECRET || 'dev-secret-change-me';
  return new TextEncoder().encode(secret);
}

export function agentLoginFilter(login: string) {
  const normalized = login.toLowerCase().trim();
  return {
    $or: [
      { username: normalized },
      { name: { $regex: new RegExp(`^${normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
    ],
  };
}

export async function createToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL}s`)
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

async function resolveAgentSession(payload: SessionPayload): Promise<SessionPayload | null> {
  if (!payload.username) return null;
  const { Agent } = await getModels();
  const agent = await Agent.findOne(agentLoginFilter(payload.username));
  if (!agent) return null;
  return {
    role: 'agent',
    username: agent.username,
    agentId: agent._id.toString(),
    agentName: agent.name,
  };
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload?.role) return null;

  if (payload.role === 'admin') {
    return { role: 'admin', username: payload.username };
  }

  if (payload.role === 'agent') {
    return resolveAgentSession(payload);
  }

  return null;
}

export async function verifyAgentCredentials(
  username: string,
  password: string
): Promise<{ username: string; agentName: string } | null> {
  const { Agent } = await getModels();
  const agent = await Agent.findOne(agentLoginFilter(username));
  if (!agent) return null;
  if (await comparePassword(password, agent.passwordHash)) {
    return { username: agent.username, agentName: agent.name };
  }
  return null;
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_TTL,
    path: '/',
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
    path: '/',
  });
}

export async function verifyAdmin(username: string, password: string): Promise<boolean> {
  const adminUser = process.env.RM_USERNAME || 'admin';
  const adminPass = process.env.RM_PASSWORD || 'admin1001';
  return username === adminUser && password === adminPass;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export { COOKIE_NAME };
