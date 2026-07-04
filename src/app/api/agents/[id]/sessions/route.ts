import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { getSession } from '@/lib/auth';
import { jsonOk, jsonError, requireAdmin } from '@/lib/api-utils';
import { getAgentSessionIds } from '@/lib/sim-service';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  const denied = requireAdmin(session);
  if (denied) return denied;

  const { id } = await params;
  await connectDB();
  const sessions = await getAgentSessionIds(id);
  return jsonOk(sessions);
}
