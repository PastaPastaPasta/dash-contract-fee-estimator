import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parseRustFeeConstants, findVersionFiles, findLatestVersionFile } from '../src/lib/rust-parser';

const v2Source = readFileSync(
  resolve(__dirname, 'fixtures/fee-constants-v2.rs'),
  'utf-8',
);

describe('parseRustFeeConstants', () => {
  it('parses all fields from v2.rs', () => {
    const constants = parseRustFeeConstants(v2Source);
    expect(constants.baseContractRegistrationFee).toBe(10_000_000_000);
    expect(constants.documentTypeRegistrationFee).toBe(2_000_000_000);
    expect(constants.documentTypeBaseNonUniqueIndexRegistrationFee).toBe(1_000_000_000);
    expect(constants.documentTypeBaseUniqueIndexRegistrationFee).toBe(1_000_000_000);
    expect(constants.documentTypeBaseContestedIndexRegistrationFee).toBe(100_000_000_000);
    expect(constants.tokenRegistrationFee).toBe(10_000_000_000);
    expect(constants.tokenUsesPerpetualDistributionFee).toBe(10_000_000_000);
    expect(constants.tokenUsesPreProgrammedDistributionFee).toBe(10_000_000_000);
    expect(constants.searchKeywordFee).toBe(10_000_000_000);
  });

  it('handles Rust numeric literals with underscores', () => {
    const source = `
      base_contract_registration_fee: 1_000,
      document_type_registration_fee: 2_000,
      document_type_base_non_unique_index_registration_fee: 3_000,
      document_type_base_unique_index_registration_fee: 4_000,
      document_type_base_contested_index_registration_fee: 5_000,
      token_registration_fee: 6_000,
      token_uses_perpetual_distribution_fee: 7_000,
      token_uses_pre_programmed_distribution_fee: 8_000,
      search_keyword_fee: 9_000,
    `;
    const constants = parseRustFeeConstants(source);
    expect(constants.baseContractRegistrationFee).toBe(1000);
    expect(constants.searchKeywordFee).toBe(9000);
  });

  it('parses zero values (like v1)', () => {
    const source = `
      base_contract_registration_fee: 0,
      document_type_registration_fee: 0,
      document_type_base_non_unique_index_registration_fee: 0,
      document_type_base_unique_index_registration_fee: 0,
      document_type_base_contested_index_registration_fee: 0,
      token_registration_fee: 0,
      token_uses_perpetual_distribution_fee: 0,
      token_uses_pre_programmed_distribution_fee: 0,
      search_keyword_fee: 0,
    `;
    const constants = parseRustFeeConstants(source);
    expect(constants.baseContractRegistrationFee).toBe(0);
  });

  it('throws on missing fields', () => {
    const incomplete = `
      base_contract_registration_fee: 100,
      document_type_registration_fee: 200,
    `;
    expect(() => parseRustFeeConstants(incomplete)).toThrow('Missing fee fields');
  });

  it('throws on empty input', () => {
    expect(() => parseRustFeeConstants('')).toThrow('Missing fee fields');
  });

  it('ignores non-fee fields in source', () => {
    const source = `
      some_other_field: 999,
      base_contract_registration_fee: 100,
      document_type_registration_fee: 200,
      document_type_base_non_unique_index_registration_fee: 300,
      document_type_base_unique_index_registration_fee: 400,
      document_type_base_contested_index_registration_fee: 500,
      token_registration_fee: 600,
      token_uses_perpetual_distribution_fee: 700,
      token_uses_pre_programmed_distribution_fee: 800,
      search_keyword_fee: 900,
      yet_another_field: 1000,
    `;
    const constants = parseRustFeeConstants(source);
    expect(constants.baseContractRegistrationFee).toBe(100);
    expect(constants.searchKeywordFee).toBe(900);
  });
});

describe('findVersionFiles', () => {
  it('finds all versions sorted ascending', () => {
    const modSource = `
      pub mod v1;
      pub mod v2;
    `;
    expect(findVersionFiles(modSource)).toEqual(['v1.rs', 'v2.rs']);
  });

  it('handles unordered modules', () => {
    const modSource = `
      pub mod v3;
      pub mod v1;
      pub mod v2;
    `;
    expect(findVersionFiles(modSource)).toEqual(['v1.rs', 'v2.rs', 'v3.rs']);
  });

  it('throws on empty mod.rs', () => {
    expect(() => findVersionFiles('// nothing here')).toThrow('No version modules');
  });
});

describe('findLatestVersionFile', () => {
  it('returns the highest version', () => {
    const modSource = 'pub mod v1;\npub mod v2;\npub mod v3;';
    expect(findLatestVersionFile(modSource)).toBe('v3.rs');
  });

  it('works with single version', () => {
    expect(findLatestVersionFile('pub mod v1;')).toBe('v1.rs');
  });
});
