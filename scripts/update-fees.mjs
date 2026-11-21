/**
 * Regenerates src/lib/constants.ts from the newest stable Dash Platform release.
 * The release tag comes from GitHub's releases/latest (never a pre-release or a branch such as master),
 * and every fee file is read at that tag. Run via: node scripts/update-fees.mjs
 */
import { appendFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = 'dashpay/platform';
const FEE_PATH = 'packages/rs-platform-version/src/version/fee/data_contract_registration';

const FIELD_MAP = {
  base_contract_registration_fee: 'baseContractRegistrationFee',
  document_type_registration_fee: 'documentTypeRegistrationFee',
  document_type_base_non_unique_index_registration_fee: 'documentTypeBaseNonUniqueIndexRegistrationFee',
  document_type_base_unique_index_registration_fee: 'documentTypeBaseUniqueIndexRegistrationFee',
  document_type_base_contested_index_registration_fee: 'documentTypeBaseContestedIndexRegistrationFee',
  token_registration_fee: 'tokenRegistrationFee',
  token_uses_perpetual_distribution_fee: 'tokenUsesPerpetualDistributionFee',
  token_uses_pre_programmed_distribution_fee: 'tokenUsesPreProgrammedDistributionFee',
  token_uses_once_per_identity_distribution_fee: 'tokenUsesOncePerIdentityDistributionFee',
  search_keyword_fee: 'searchKeywordFee',
};

async function get(fetchImpl, url, kind) {
  const response = await fetchImpl(url, {
    headers: kind === 'json'
      ? {
          'User-Agent': 'dash-fee-estimator',
          Accept: 'application/vnd.github+json',
          ...(process.env.GH_TOKEN ? { Authorization: `Bearer ${process.env.GH_TOKEN}` } : {}),
        }
      : {},
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return kind === 'json' ? response.json() : response.text();
}

export async function buildConstants(fetchImpl = fetch) {
  const release = await get(fetchImpl, `https://api.github.com/repos/${REPO}/releases/latest`, 'json');
  const tag = release.tag_name;
  if (release.prerelease || release.draft || !/^v\d+\.\d+\.\d+$/.test(tag ?? '')) {
    throw new Error(`Latest release is not a stable vX.Y.Z tag: ${tag}`);
  }
  const commit = await get(fetchImpl, `https://api.github.com/repos/${REPO}/commits/${tag}`, 'json');
  if (!/^[0-9a-f]{40}$/.test(commit.sha ?? '')) throw new Error(`Could not resolve ${tag} to a commit`);
  const base = `https://raw.githubusercontent.com/${REPO}/${commit.sha}/${FEE_PATH}`;

  const modSource = await get(fetchImpl, `${base}/mod.rs`, 'text');
  const versions = [...modSource.matchAll(/pub\s+mod\s+v(\d+)\s*;/g)].map((m) => Number(m[1]));
  if (versions.length === 0) throw new Error('No version modules found in mod.rs');
  const versionFile = `v${Math.max(...versions)}.rs`;

  async function readVersion(file, seen = new Set()) {
    if (!/^v\d+\.rs$/.test(file) || seen.has(file) || seen.size > 10) throw new Error('Invalid fee table inheritance');
    seen.add(file);
    const source = await get(fetchImpl, `${base}/${file}`, 'text');
    const parent = source.match(/\.\.FEE_DATA_CONTRACT_REGISTRATION_VERSION(\d+)\b/);
    const parsed = parent ? await readVersion(`v${parent[1]}.rs`, seen) : {};
    for (const [, name, value] of source.matchAll(/(\w+):\s*([\d_]+)/g)) {
      if (name in FIELD_MAP) parsed[name] = Number(value.replace(/_/g, ''));
      else if (name.endsWith('_fee')) throw new Error(`Unsupported fee field: ${name}`);
    }
    return parsed;
  }
  const parsed = await readVersion(versionFile);
  const missing = Object.keys(FIELD_MAP).filter((field) => !(field in parsed));
  if (missing.length) throw new Error(`Missing fee fields: ${missing.join(', ')}`);

  const formatNum = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '_');
  const lines = Object.entries(FIELD_MAP).map(([rustName, camelName]) =>
    `  ${camelName}: ${formatNum(parsed[rustName])}, // ${parsed[rustName] / 100_000_000_000} Dash`);
  const sourceDate = new Date(commit.commit.committer.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

  const output = `import type { FeeConstants } from './types';

/** Bundled fee constants (${versionFile}, Platform ${tag}) - auto-updated by CI */
export const DEFAULT_FEE_CONSTANTS: FeeConstants = {
${lines.join('\n')}
};

export const BUNDLED_FEE_TABLE = {
  version: '${versionFile}',
  tag: '${tag}',
  revision: '${commit.sha}',
  sourceDate: '${sourceDate}',
};

export const FEE_CONSTANTS_PATH = '${FEE_PATH}';

/** Raw fee files at the pinned Platform release */
export const FEE_CONSTANTS_BASE_URL =
  'https://raw.githubusercontent.com/${REPO}/${tag}/${FEE_PATH}';

/** GitHub blob URL for linking to source (not raw) */
export const FEE_CONSTANTS_BLOB_BASE_URL =
  'https://github.com/${REPO}/blob/${tag}/${FEE_PATH}';
`;
  return { output, tag, versionFile };
}

async function main() {
  const { output, tag, versionFile } = await buildConstants();
  const outPath = resolve(import.meta.dirname, '..', 'src', 'lib', 'constants.ts');
  writeFileSync(outPath, output, 'utf-8');
  console.log(`Updated ${outPath} from Platform ${tag} (${versionFile})`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `tag=${tag}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
