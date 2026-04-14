/**
 * Fetches the latest fee constants from the DPP Rust source and updates constants.ts.
 * Run via: node scripts/update-fees.mjs
 */

const SOURCE_URL =
  'https://raw.githubusercontent.com/dashpay/platform/master/packages/rs-platform-version/src/version/fee/data_contract_registration/v2.rs';

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
  console.log('Fetching fee constants from:', SOURCE_URL);
  const resp = await fetch(SOURCE_URL);
  if (!resp.ok) {
    throw new Error(`Failed to fetch: ${resp.status} ${resp.statusText}`);
  }

  const source = await resp.text();
  const fieldPattern = /(\w+):\s*([\d_]+)/g;
  const parsed = {};

  let match;
  while ((match = fieldPattern.exec(source)) !== null) {
    const [, fieldName, rawValue] = match;
    if (FIELD_MAP[fieldName]) {
      parsed[fieldName] = Number(rawValue.replace(/_/g, ''));
    }
  }

  const missing = Object.keys(FIELD_MAP).filter((f) => !(f in parsed));
  if (missing.length > 0) {
    throw new Error(`Missing fee fields in source: ${missing.join(', ')}`);
  }

  // Format numbers with underscores for readability
  const formatNum = (n) => {
    const s = String(n);
    if (s.length <= 3) return s;
    return s.replace(/\B(?=(\d{3})+(?!\d))/g, '_');
  };

  // Compute Dash equivalents for comments
  const toDash = (n) => n / 100_000_000_000;

  const lines = Object.entries(FIELD_MAP).map(([rustName, camelName]) => {
    const val = parsed[rustName];
    const dash = toDash(val);
    return `  ${camelName}: ${formatNum(val)}, // ${dash} Dash`;
  });

  const output = `import type { FeeConstants } from './types';

/** Bundled fee constants from protocol version 9 (Dash 2.0) - auto-updated by CI */
export const DEFAULT_FEE_CONSTANTS: FeeConstants = {
${lines.join('\n')}
};

/** Source URL for fetching latest fee constants from DPP */
export const FEE_CONSTANTS_SOURCE_URL =
  '${SOURCE_URL}';
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
