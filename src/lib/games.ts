export type GameKey = '35k' | '20k';

export const DEFAULT_GAME: GameKey = '35k';

export const GAME_TYPES: GameKey[] = ['35k', '20k'];

export const GAMES: { key: GameKey; label: string }[] = [
  { key: '35k', label: '35K Win' },
  { key: '20k', label: '20K Win' },
];

export function isGameKey(value: string | null | undefined): value is GameKey {
  return value === '35k' || value === '20k';
}

export function getGameLabel(key: GameKey): string {
  return GAMES.find((g) => g.key === key)?.label ?? key;
}

/** Single shared MongoDB database URI */
export function getMongoUri(): string {
  return process.env.MONGODB_URI || 'mongodb://localhost:27017/reward-manager';
}
