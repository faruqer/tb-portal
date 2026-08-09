import { extractSessionIndex } from '@/lib/session-sync';

export interface ParsedSessionPayload {
  token: string | null;
  phone: string | null;
}

export function parseSessionPayload(data: unknown): ParsedSessionPayload {
  const obj = data as Record<string, unknown> | null;
  const token = obj?.SRBNtoken ? String(obj.SRBNtoken).trim() : null;
  const phone = obj?.SRBNphone ? String(obj.SRBNphone).trim() : null;
  return { token: token || null, phone: phone || null };
}

export function sessionIdFromFilename(filename: string): number | null {
  return extractSessionIndex(filename);
}

export interface SessionUploadInput {
  filename: string;
  data?: unknown;
  error?: string;
}

export interface SessionUploadResult {
  filename: string;
  sessionId: number | null;
  phoneNumber: string | null;
  ok: boolean;
  message: string;
}
