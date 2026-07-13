import type { GameKey } from '@/lib/games';

export function gameRowClass(gameType?: string): string {
  if (gameType === '35k') return 'row-game-35k';
  if (gameType === '20k') return 'row-game-20k';
  return '';
}

export function gameTypeLabel(gameType?: string): string {
  if (gameType === '35k') return '35K';
  if (gameType === '20k') return '20K';
  return '';
}

export function gameBadgeClass(gameType?: string): string {
  if (gameType === '35k') return 'badge-game-35k';
  if (gameType === '20k') return 'badge-game-20k';
  return 'badge-muted';
}
