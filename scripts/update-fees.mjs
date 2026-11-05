/**
 * Fetches the latest fee constants from the DPP Rust source and updates constants.ts.
 * Automatically discovers the latest version by parsing mod.rs.
 * Run via: node scripts/update-fees.mjs
 */

const BASE_URL =
  'https://raw.githubusercontent.com/dashpay/platform/master/packages/rs-platform-version/src/version/fee/data_contract_registration';

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

async function main() {
  const commitResponse = await fetch('https://api.github.com/repos/dashpay/platform/commits/master', { headers: { 'User-Agent': 'dash-fee-estimator' }, signal: AbortSignal.timeout(12000) });
  if (!commitResponse.ok) throw new Error(`Could not resolve source revision: ${commitResponse.status}`);
  const commit = await commitResponse.json();
  const pinnedBase = BASE_URL.replace('/master/', `/${commit.sha}/`);
  // Discover latest version from mod.rs
  console.log('Fetching mod.rs to discover versions...');
  const modResp = await fetch(`${pinnedBase}/mod.rs`, { signal: AbortSignal.timeout(12000) });
  if (!modResp.ok) throw new Error(`Failed to fetch mod.rs: ${modResp.status}`);
  const modSource = await modResp.text();

  const modPattern = /pub\s+mod\s+(v(\d+))\s*;/g;
  let highest = 0;
  let match;
  while ((match = modPattern.exec(modSource)) !== null) {
    const version = Number(match[2]);
    if (version > highest) highest = version;
  }
  if (highest === 0) throw new Error('No version modules found in mod.rs');

  const versionFile = `v${highest}.rs`;
  async function readVersion(file, seen = new Set()) {
    if (!/^v\d+\.rs$/.test(file) || seen.has(file) || seen.size > 10) throw new Error('Invalid fee table inheritance');
    seen.add(file);
    const response = await fetch(`${pinnedBase}/${file}`, { signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error(`Fee table ${file}: ${response.status}`);
    const source = await response.text();
    const parent = source.match(/\.\.FEE_DATA_CONTRACT_REGISTRATION_VERSION(\d+)\b/);
    const parsed = parent ? await readVersion(`v${parent[1]}.rs`, seen) : {};
    for (const [, name, value] of source.matchAll(/(\w+):\s*([\d_]+)/g)) {
      if (name in FIELD_MAP) parsed[name] = Number(value.replace(/_/g, ''));
      else if (name.endsWith('_fee')) throw new Error(`Unsupported fee field: ${name}`);
    }
    return parsed;
  }
  const parsed = await readVersion(versionFile);
  const missing = Object.keys(FIELD_MAP).filter((field) => field !== 'token_uses_once_per_identity_distribution_fee' && !(field in parsed));
  if (missing.length) throw new Error(`Missing fee fields: ${missing.join(', ')}`);
  const formatNum = (n) => {
    const s = String(n);
    if (s.length <= 3) return s;
    return s.replace(/\B(?=(\d{3})+(?!\d))/g, '_');
  };

  const toDash = (n) => n / 100_000_000_000;

  const lines = Object.entries(FIELD_MAP).filter(([name]) => name in parsed).map(([rustName, camelName]) => {
    const val = parsed[rustName];
    const dash = toDash(val);
    return `  ${camelName}: ${formatNum(val)}, // ${dash} Dash`;
  });

  const output = `import type { FeeConstants } from './types';

/** Bundled fee constants (${versionFile}) - auto-updated by CI */
export const DEFAULT_FEE_CONSTANTS: FeeConstants = {
${lines.join('\n')}
};

export const BUNDLED_FEE_TABLE = {
  version: '${versionFile}',
  revision: '${commit.sha}',
  sourceDate: '${new Date(commit.commit.committer.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}',
};

/** Base directory URL for fee constant source files in DPP */
export const FEE_CONSTANTS_BASE_URL =
  '${BASE_URL}';

/** GitHub blob URL for linking to source (not raw) */
export const FEE_CONSTANTS_BLOB_BASE_URL =
  'https://github.com/dashpay/platform/blob/master/packages/rs-platform-version/src/version/fee/data_contract_registration';
`;

  const { writeFileSync } = await import('fs');
  const { resolve } = await import('path');
  const outPath = resolve(import.meta.dirname, '..', 'src', 'lib', 'constants.ts');
  writeFileSync(outPath, output, 'utf-8');
  console.log('Updated:', outPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
