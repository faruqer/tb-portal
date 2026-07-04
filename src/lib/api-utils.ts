import { NextResponse } from 'next/server';
import type { SessionPayload } from './types';

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function requireAdmin(session: SessionPayload | null) {
  if (!session || session.role !== 'admin') {
    return jsonError('Unauthorized', 401);
  }
  return null;
}

export function requireAgent(session: SessionPayload | null) {
  if (!session || session.role !== 'agent' || !session.agentId) {
    return jsonError('Unauthorized', 401);
  }
  return null;
}

export function requireAuth(session: SessionPayload | null) {
  if (!session) {
    return jsonError('Unauthorized', 401);
  }
  return null;
}

export function serializeDoc<T extends { _id: { toString(): string }; createdAt?: Date; updatedAt?: Date }>(
  doc: T
) {
  const { _id, createdAt, updatedAt, ...rest } = doc as T & Record<string, unknown>;
  return {
    id: _id.toString(),
    ...rest,
    createdAt: createdAt?.toISOString?.() ?? createdAt,
    updatedAt: updatedAt?.toISOString?.() ?? updatedAt,
  };
}
