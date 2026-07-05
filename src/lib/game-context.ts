import { cookies } from 'next/headers';
import { DEFAULT_GAME, isGameKey, type GameKey } from '@/lib/games';

export const GAME_COOKIE = 'rm_game';

export async function getGameKey(): Promise<GameKey> {
  const cookieStore = await cookies();
  const value = cookieStore.get(GAME_COOKIE)?.value;
  return isGameKey(value) ? value : DEFAULT_GAME;
}

export async function setGameCookie(key: GameKey) {
  const cookieStore = await cookies();
  cookieStore.set(GAME_COOKIE, key, {
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
  });
}
