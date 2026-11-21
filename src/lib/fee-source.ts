import { BUNDLED_FEE_TABLE, FEE_CONSTANTS_PATH } from './constants';
import { findVersionFiles, inheritedFeeVersion, parseRustFeeConstants } from './rust-parser';
import type { FeeConstants } from './types';

const TIMEOUT = 12000;
const STABLE_TAG = /^v\d+\.\d+\.\d+$/;

export const feeFileUrl = (ref: string, file: string) =>
  `https://raw.githubusercontent.com/dashpay/platform/${ref}/${FEE_CONSTANTS_PATH}/${file}`;

export const feeBlobUrl = (ref: string, file: string) =>
  `https://github.com/dashpay/platform/blob/${ref}/${FEE_CONSTANTS_PATH}/${file}`;

async function read(url: string): Promise<Response> {
  const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT), credentials: 'omit' });
  if (!response.ok) throw new Error(`Fee source unavailable (${response.status})`);
  return response;
}

/** The newest stable Platform release tag (vX.Y.Z); pre-releases and branches are never used. */
export async function latestStableRelease(): Promise<string> {
  const release = await (await read('https://api.github.com/repos/dashpay/platform/releases/latest')).json();
  if (release.prerelease || release.draft || !STABLE_TAG.test(release.tag_name ?? '')) {
    throw new Error('No stable Platform release tag');
  }
  return release.tag_name;
}

export async function fetchVersionFiles(ref: string = BUNDLED_FEE_TABLE.tag): Promise<string[]> {
  return findVersionFiles(await (await read(feeFileUrl(ref, 'mod.rs'))).text());
}

export async function fetchFeeVersion(
  version: string,
  ref: string = BUNDLED_FEE_TABLE.tag,
  seen = new Set<string>(),
): Promise<FeeConstants> {
  if (!/^v\d+\.rs$/.test(version) || seen.has(version) || seen.size > 10) throw new Error('Invalid fee table inheritance');
  seen.add(version);
  const source = await (await read(feeFileUrl(ref, version))).text();
  const parent = inheritedFeeVersion(source);
  return parseRustFeeConstants(source, parent ? await fetchFeeVersion(parent, ref, seen) : undefined);
}
