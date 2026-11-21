import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fetchFeeVersion, fetchVersionFiles, latestStableRelease } from '../src/lib/fee-source';
import { parseRustFeeConstants } from '../src/lib/rust-parser';
import { BUNDLED_FEE_TABLE, DEFAULT_FEE_CONSTANTS, FEE_CONSTANTS_BASE_URL } from '../src/lib/constants';
import { BUNDLED_SCHEDULES } from '../src/lib/schedules';
// @ts-expect-error untyped script module
import { buildConstants } from '../scripts/update-fees.mjs';

const fixture = (name: string) => readFileSync(resolve(__dirname, 'fixtures', name), 'utf-8');
const files: Record<string, string> = {
  'mod.rs': fixture('fee-constants-mod.rs'),
  'v2.rs': fixture('fee-constants-v2.rs'),
  'v3.rs': fixture('fee-constants-v3.rs'),
};
const SHA = BUNDLED_FEE_TABLE.revision;
const requested: string[] = [];

function platform(release: Record<string, unknown> = { tag_name: BUNDLED_FEE_TABLE.tag, prerelease: false, draft: false }) {
  return vi.fn(async (input: string | URL) => {
    const url = String(input);
    requested.push(url);
    const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
    if (url.endsWith('/releases/latest')) return json(release);
    if (url.includes('/commits/')) return json({ sha: SHA, commit: { committer: { date: '2026-11-04T00:43:26+07:00' } } });
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
    expect(constants).toEqual(DEFAULT_FEE_CONSTANTS);
    expect(() => parseRustFeeConstants(files['v3.rs'])).toThrow('Missing fee fields');
  });

  it('fetches v3.rs and its parent at the pinned release tag', async () => {
    vi.stubGlobal('fetch', platform());
    expect(await fetchFeeVersion('v3.rs')).toEqual(BUNDLED_SCHEDULES['v3.rs']);
    expect(await fetchVersionFiles()).toEqual(['v1.rs', 'v2.rs', 'v3.rs']);
    expect(requested.every((url) => url.includes(`/dashpay/platform/${BUNDLED_FEE_TABLE.tag}/`))).toBe(true);
    expect(requested.some((url) => url.includes('/master/'))).toBe(false);
  });

  it('regenerates the bundled constants unchanged from the stable release', async () => {
    const { output, tag, versionFile } = await buildConstants(platform());
    expect([tag, versionFile]).toEqual([BUNDLED_FEE_TABLE.tag, BUNDLED_FEE_TABLE.version]);
    const table = (source: string) => source.slice(source.indexOf('export const DEFAULT_FEE_CONSTANTS'), source.indexOf('export const BUNDLED_FEE_TABLE'));
    expect(table(output)).toBe(table(readFileSync(resolve(__dirname, '../src/lib/constants.ts'), 'utf-8')));
    expect(output).toContain(`'https://raw.githubusercontent.com/dashpay/platform/${BUNDLED_FEE_TABLE.tag}/`);
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
