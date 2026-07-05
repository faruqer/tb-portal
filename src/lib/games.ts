export type GameKey = '35k' | '20k';

export const DEFAULT_GAME: GameKey = '35k';

export const GAMES: { key: GameKey; label: string; dbEnv: string; defaultDb: string }[] = [
  { key: '35k', label: '35K Win', dbEnv: 'MONGODB_DB_35K', defaultDb: 'reward-manager' },
  { key: '20k', label: '20K Win', dbEnv: 'MONGODB_DB_20K', defaultDb: 'reward-manager-20k' },
];

export function isGameKey(value: string | null | undefined): value is GameKey {
  return value === '35k' || value === '20k';
}

export function getGameLabel(key: GameKey): string {
  return GAMES.find((g) => g.key === key)?.label ?? key;
}

export function getDbName(key: GameKey): string {
  const game = GAMES.find((g) => g.key === key)!;
  return process.env[game.dbEnv] || game.defaultDb;
}

/** Build Mongo URI for a game database on the same cluster */
export function getMongoUri(key: GameKey): string {
  const base = process.env.MONGODB_URI || 'mongodb://localhost:27017/reward-manager-35k';
  const dbName = getDbName(key);
  if (base.includes('mongodb+srv://') || base.includes('mongodb://')) {
    const [withoutQuery, query = ''] = base.split('?');
    const slash = withoutQuery.lastIndexOf('/');
    if (slash > 'mongodb://'.length) {
      const prefix = withoutQuery.slice(0, slash + 1);
      return query ? `${prefix}${dbName}?${query}` : `${prefix}${dbName}`;
    }
    return query ? `${withoutQuery}/${dbName}?${query}` : `${withoutQuery}/${dbName}`;
  }
  return base;
}
