import { NextRequest } from 'next/server';
import { getGameKey, setGameCookie } from '@/lib/game-context';
import { jsonOk, jsonError } from '@/lib/api-utils';
import { GAMES, getGameLabel, isGameKey } from '@/lib/games';

export async function GET() {
  const key = await getGameKey();
  return jsonOk({ game: key, label: getGameLabel(key), games: GAMES.map((g) => ({ key: g.key, label: g.label })) });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { game } = body || {};
  if (!isGameKey(game)) return jsonError('Invalid game');

  await setGameCookie(game);
  return jsonOk({ game, label: getGameLabel(game) });
}
