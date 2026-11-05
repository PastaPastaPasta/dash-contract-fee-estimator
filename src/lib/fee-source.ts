import { FEE_CONSTANTS_BASE_URL } from './constants';
import { inheritedFeeVersion, parseRustFeeConstants } from './rust-parser';
import type { FeeConstants } from './types';

export async function fetchFeeVersion(version: string, seen = new Set<string>()): Promise<FeeConstants> {
  if (!/^v\d+\.rs$/.test(version) || seen.has(version) || seen.size > 10) throw new Error('Invalid fee table inheritance');
  seen.add(version);
  const response = await fetch(`${FEE_CONSTANTS_BASE_URL}/${version}`, { signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error(`Fee table unavailable (${response.status})`);
  const source = await response.text();
  const parent = inheritedFeeVersion(source);
  return parseRustFeeConstants(source, parent ? await fetchFeeVersion(parent, seen) : undefined);
}
