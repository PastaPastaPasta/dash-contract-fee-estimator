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
  search_keyword_fee: 'searchKeywordFee',
};

async function main() {
  // Discover latest version from mod.rs
  console.log('Fetching mod.rs to discover versions...');
  const modResp = await fetch(`${BASE_URL}/mod.rs`);
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
  const sourceUrl = `${BASE_URL}/${versionFile}`;
  console.log(`Latest version: ${versionFile}`);
  console.log('Fetching fee constants from:', sourceUrl);

  const resp = await fetch(sourceUrl);
  if (!resp.ok) throw new Error(`Failed to fetch: ${resp.status} ${resp.statusText}`);

  const source = await resp.text();
  const fieldPattern = /(\w+):\s*([\d_]+)/g;
  const parsed = {};

  while ((match = fieldPattern.exec(source)) !== null) {
    const [, fieldName, rawValue] = match;
    if (fieldName in FIELD_MAP) {
      parsed[fieldName] = Number(rawValue.replace(/_/g, ''));
    }
  }

  const missing = Object.keys(FIELD_MAP).filter((f) => !(f in parsed));
  if (missing.length > 0) {
    throw new Error(`Missing fee fields in source: ${missing.join(', ')}`);
  }

  const formatNum = (n) => {
    const s = String(n);
    if (s.length <= 3) return s;
    return s.replace(/\B(?=(\d{3})+(?!\d))/g, '_');
  };

  const toDash = (n) => n / 100_000_000_000;

  const lines = Object.entries(FIELD_MAP).map(([rustName, camelName]) => {
    const val = parsed[rustName];
    const dash = toDash(val);
    return `  ${camelName}: ${formatNum(val)}, // ${dash} Dash`;
  });

  const output = `import type { FeeConstants } from './types';

/** Bundled fee constants (${versionFile}) - auto-updated by CI */
export const DEFAULT_FEE_CONSTANTS: FeeConstants = {
${lines.join('\n')}
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
