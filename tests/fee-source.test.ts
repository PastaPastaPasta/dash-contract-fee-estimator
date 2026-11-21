import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fetchFeeVersion, fetchVersionFiles, latestStableRelease } from '../src/lib/fee-source';
import { parseRustFeeConstants } from '../src/lib/rust-parser';
import { BUNDLED_FEE_TABLE, FEE_CONSTANTS_BASE_URL } from '../src/lib/constants';
import { PLATFORM_V5_0_3 } from './fixtures/platform-v5.0.3';
// @ts-expect-error untyped script module
import { buildConstants } from '../scripts/update-fees.mjs';

const fixture = (name: string) => readFileSync(resolve(__dirname, 'fixtures', name), 'utf-8');
const files: Record<string, string> = {
  'mod.rs': fixture('fee-constants-mod.rs'),
  'v2.rs': fixture('fee-constants-v2.rs'),
  'v3.rs': fixture('fee-constants-v3.rs'),
};
const { tag: TAG, revision: SHA } = PLATFORM_V5_0_3;
const requested: string[] = [];

function platform(release: Record<string, unknown> = { tag_name: TAG, prerelease: false, draft: false }) {
  return vi.fn(async (input: string | URL) => {
    const url = String(input);
    requested.push(url);
    const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
    if (url.endsWith('/releases/latest')) return json(release);
    if (url.includes('/commits/')) return json({ sha: SHA, commit: { committer: { date: PLATFORM_V5_0_3.committedAt } } });
    const file = url.split('/').pop()!;
    return files[file] ? new Response(files[file], { status: 200 }) : new Response('', { status: 404 });
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  requested.length = 0;
});

describe('inherited v3-style fee file', () => {
  it('parses Platform v5.0.3 v3.rs through its v2 parent', () => {
    const constants = parseRustFeeConstants(files['v3.rs'], parseRustFeeConstants(files['v2.rs']));
    expect(constants).toEqual(PLATFORM_V5_0_3.v3);
    expect(() => parseRustFeeConstants(files['v3.rs'])).toThrow('Missing fee fields');
  });

  it('fetches v3.rs and its parent at the requested release tag', async () => {
    vi.stubGlobal('fetch', platform());
    expect(await fetchFeeVersion('v3.rs', TAG)).toEqual(PLATFORM_V5_0_3.v3);
    expect(await fetchVersionFiles(TAG)).toEqual(['v1.rs', 'v2.rs', 'v3.rs']);
    expect(requested.every((url) => url.includes(`/dashpay/platform/${TAG}/`))).toBe(true);
    expect(requested.some((url) => url.includes('/master/'))).toBe(false);
  });

  it('generates the constants module from the stable release', async () => {
    const { output, tag, versionFile } = await buildConstants(platform());
    expect([tag, versionFile]).toEqual([TAG, 'v3.rs']);
    const underscored = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '_');
    for (const [field, credits] of Object.entries(PLATFORM_V5_0_3.v3)) expect(output).toContain(`  ${field}: ${underscored(credits)},`);
    expect(output).toContain(`version: 'v3.rs',\n  tag: '${TAG}',\n  revision: '${SHA}',\n  sourceDate: '${PLATFORM_V5_0_3.sourceDate}',`);
    const exports = (source: string) => [...source.matchAll(/^export const (\w+)/gm)].map((m) => m[1]);
    expect(exports(output)).toEqual(exports(readFileSync(resolve(__dirname, '../src/lib/constants.ts'), 'utf-8')));
    expect(output).toContain(`'https://raw.githubusercontent.com/dashpay/platform/${TAG}/`);
    expect(requested.filter((url) => url.startsWith('https://raw.')).every((url) => url.includes(`/${SHA}/`))).toBe(true);
  });

  it('refuses a pre-release or a branch as the source', async () => {
    await expect(buildConstants(platform({ tag_name: 'v5.1.0-dev.2', prerelease: true }))).rejects.toThrow('stable');
    vi.stubGlobal('fetch', platform({ tag_name: 'master', prerelease: false }));
    await expect(latestStableRelease()).rejects.toThrow('stable');
  });
});

describe('pinned source', () => {
  it('never points at a moving branch', () => {
    expect(BUNDLED_FEE_TABLE.tag).toMatch(/^v\d+\.\d+\.\d+$/);
    expect(FEE_CONSTANTS_BASE_URL).toContain(`/dashpay/platform/${BUNDLED_FEE_TABLE.tag}/`);
    expect(BUNDLED_FEE_TABLE.revision).toMatch(/^[0-9a-f]{40}$/);
  });
});
