import { CREDITS_PER_DASH } from '../lib/types';

export function creditsToDash(credits: number): string {
  const dash = credits / CREDITS_PER_DASH;
  if (dash >= 0.01) return dash.toFixed(2);
  return dash.toFixed(4);
}

export function formatCredits(credits: number): string {
  return credits.toLocaleString('en-US');
}
