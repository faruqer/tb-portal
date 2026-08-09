import type { KeyboardEvent } from 'react';

/** Save on blur; pressing Enter commits via blur (uncontrolled inputs). */
export function blurOnEnter(e: KeyboardEvent<HTMLInputElement>) {
  if (e.key === 'Enter') {
    e.preventDefault();
    e.currentTarget.blur();
  }
}
