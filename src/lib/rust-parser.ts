import type { FeeConstants } from './types';

/** Map from Rust snake_case field names to FeeConstants camelCase keys */
const FIELD_MAP: Record<string, keyof FeeConstants> = {
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

const EXPECTED_FIELDS = Object.keys(FIELD_MAP);

/**
 * Parse a Rust source file (like v2.rs) to extract fee constants.
 * Matches lines of the form: `field_name: 10_000_000_000,`
 */
export function parseRustFeeConstants(rustSource: string): FeeConstants {
  const fieldPattern = /(\w+):\s*([\d_]+)/g;
  const parsed: Record<string, number> = {};

  let match;
  while ((match = fieldPattern.exec(rustSource)) !== null) {
    const [, fieldName, rawValue] = match;
    if (fieldName in FIELD_MAP) {
      parsed[fieldName] = Number(rawValue.replace(/_/g, ''));
    }
  }

  const missing = EXPECTED_FIELDS.filter((f) => !(f in parsed));
  if (missing.length > 0) {
    throw new Error(`Missing fee fields in Rust source: ${missing.join(', ')}`);
  }

  const result = {} as FeeConstants;
  for (const [rustName, camelName] of Object.entries(FIELD_MAP)) {
    result[camelName] = parsed[rustName];
  }

  return result;
}

/**
 * Parse a Rust mod.rs to find all version modules (e.g. ["v1.rs", "v2.rs"]).
 * Returns sorted ascending by version number.
 */
export function findVersionFiles(modSource: string): string[] {
  const modPattern = /pub\s+mod\s+(v(\d+))\s*;/g;
  const versions: { file: string; num: number }[] = [];
  let match;
  while ((match = modPattern.exec(modSource)) !== null) {
    versions.push({ file: `${match[1]}.rs`, num: Number(match[2]) });
  }
  if (versions.length === 0) {
    throw new Error('No version modules found in mod.rs');
  }
  return versions.sort((a, b) => a.num - b.num).map((v) => v.file);
}

/**
 * Parse a Rust mod.rs to find the highest version module.
 * Returns the version filename like "v2.rs".
 */
export function findLatestVersionFile(modSource: string): string {
  const files = findVersionFiles(modSource);
  return files[files.length - 1];
}
