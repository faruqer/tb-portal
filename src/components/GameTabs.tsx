'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { GameKey } from '@/lib/games';

interface GameOption {
  key: GameKey;
  label: string;
}

interface GameTabsProps {
  /** @deprecated Login no longer uses game tabs */
  selectOnly?: boolean;
}

export function GameTabs({ selectOnly = false }: GameTabsProps) {
  const router = useRouter();
  const [current, setCurrent] = useState<GameKey>('35k');
  const [games, setGames] = useState<GameOption[]>([
    { key: '35k', label: '35K Win' },
    { key: '20k', label: '20K Win' },
  ]);
  const [switching, setSwitching] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/game');
    if (!res.ok) return;
    const data = await res.json();
    if (data.game) setCurrent(data.game);
    if (data.games?.length) setGames(data.games);
  }, []);

  useEffect(() => {
    load().catch(console.error);
  }, [load]);

  async function switchGame(key: GameKey) {
    if (key === current || switching) return;
    setSwitching(true);
    try {
      const res = await fetch('/api/game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game: key }),
      });
      if (!res.ok) return;
      setCurrent(key);
      if (selectOnly) return;
      window.dispatchEvent(new CustomEvent('rm-game-change', { detail: key }));
      router.refresh();
    } finally {
      setSwitching(false);
    }
  }

  return (
    <div className="game-tabs-wrap">
      <div className="game-tabs" role="tablist" aria-label="Game type">
        {games.map((g) => (
          <button
            key={g.key}
            type="button"
            role="tab"
            aria-selected={current === g.key}
            className={current === g.key ? 'active' : ''}
            onClick={() => switchGame(g.key)}
            disabled={switching}
          >
            <span className="game-tab-label">{g.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
