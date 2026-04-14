import { describe, it, expect } from 'vitest';
import { estimateContractFee } from '../src/lib/estimator';
import { CREDITS_PER_DASH } from '../src/lib/types';
import type { FeeConstants, ParsedContract } from '../src/lib/types';
import dpnsContract from './fixtures/dpns-contract.json';
import dpnsContestedContract from './fixtures/dpns-contract-contested-unique-index.json';
import tokenContract from './fixtures/token-example-contract.json';

describe('estimateContractFee', () => {
  it('returns base fee for empty contract', () => {
    const result = estimateContractFee({ documentSchemas: {} });
    expect(result.totalCredits).toBe(10_000_000_000);
    expect(result.totalDash).toBeCloseTo(0.1);
    expect(result.lineItems).toHaveLength(1);
    expect(result.lineItems[0].label).toBe('Base registration');
  });

  it('calculates fees for DPNS contract (2 doc types, mixed indexes)', () => {
    const result = estimateContractFee(dpnsContract);
    // base: 10B + 2 doc types: 4B + 2 unique indexes: 2B + 1 non-unique: 1B + 1 unique (preorder): already counted
    // domain: parentNameAndLabel (unique), dashIdentityId (unique), dashAlias (non-unique) = 3 indexes
    // preorder: saltedHash (unique) = 1 index
    // Total: 10B + 4B + 3*unique(1B) + 1*nonunique(1B) = 18B credits
    expect(result.totalCredits).toBe(18_000_000_000);
    expect(result.totalDash).toBeCloseTo(0.18);
  });

  it('calculates fees for DPNS contested contract', () => {
    const result = estimateContractFee(dpnsContestedContract);
    // domain: parentNameAndLabel (contested), identityId (non-unique) = 2 indexes
    // preorder: saltedHash (unique) = 1 index
    // 2 doc types
    // base: 10B + 2 docType: 4B + 1 contested: 100B + 1 non-unique: 1B + 1 unique: 1B = 116B
    expect(result.totalCredits).toBe(116_000_000_000);
    expect(result.totalDash).toBeCloseTo(1.16);

    const contestedItem = result.lineItems.find((i) => i.label === 'Contested indexes');
    expect(contestedItem).toBeDefined();
    expect(contestedItem!.count).toBe(1);
  });

  it('calculates fees for token contract', () => {
    const result = estimateContractFee(tokenContract);
    // No document schemas (empty), 1 token, no distribution rules visible
    // base: 10B + 1 token: 10B = 20B
    expect(result.totalCredits).toBe(20_000_000_000);
    expect(result.totalDash).toBeCloseTo(0.2);
  });

  it('calculates fees for token with perpetual distribution', () => {
    const contract = {
      documentSchemas: {},
      tokens: {
        '0': {
          distributionRules: {
            perpetualDistribution: { some: 'config' },
          },
        },
      },
    };
    const result = estimateContractFee(contract);
    // base: 10B + 1 token: 10B + 1 perpetual: 10B = 30B
    expect(result.totalCredits).toBe(30_000_000_000);
  });

  it('calculates fees for token with pre-programmed distribution', () => {
    const contract = {
      documentSchemas: {},
      tokens: {
        '0': {
          distributionRules: {
            preProgrammedDistribution: { distributions: {} },
          },
        },
      },
    };
    const result = estimateContractFee(contract);
    // base: 10B + 1 token: 10B + 1 pre-programmed: 10B = 30B
    expect(result.totalCredits).toBe(30_000_000_000);
  });

  it('calculates fees for token with both distribution types', () => {
    const contract = {
      documentSchemas: {},
      tokens: {
        '0': {
          distributionRules: {
            perpetualDistribution: { some: 'config' },
            preProgrammedDistribution: { distributions: {} },
          },
        },
      },
    };
    const result = estimateContractFee(contract);
    // base: 10B + 1 token: 10B + perpetual: 10B + preProgrammed: 10B = 40B
    expect(result.totalCredits).toBe(40_000_000_000);
  });

  it('calculates keyword fees', () => {
    const contract = {
      documentSchemas: {},
      keywords: ['defi', 'payments', 'wallet'],
    };
    const result = estimateContractFee(contract);
    // base: 10B + 3 keywords: 30B = 40B
    expect(result.totalCredits).toBe(40_000_000_000);
    const kwItem = result.lineItems.find((i) => i.label === 'Search keywords');
    expect(kwItem!.count).toBe(3);
  });

  it('calculates full-featured contract', () => {
    const contract = {
      documentSchemas: {
        profile: {
          type: 'object',
          indices: [
            { name: 'byName', properties: [{ name: 'asc' }], unique: true },
            { name: 'byAge', properties: [{ age: 'asc' }] },
          ],
        },
      },
      tokens: {
        '0': {
          distributionRules: {
            perpetualDistribution: { config: true },
          },
        },
      },
      keywords: ['social', 'profile'],
    };
    const result = estimateContractFee(contract);
    // base: 10B + 1 doc: 2B + 1 unique: 1B + 1 nonunique: 1B
    // + 1 token: 10B + 1 perpetual: 10B + 2 keywords: 20B = 54B
    expect(result.totalCredits).toBe(54_000_000_000);
  });

  it('uses custom fee constants when provided', () => {
    const custom: FeeConstants = {
      baseContractRegistrationFee: 1000,
      documentTypeRegistrationFee: 100,
      documentTypeBaseNonUniqueIndexRegistrationFee: 10,
      documentTypeBaseUniqueIndexRegistrationFee: 20,
      documentTypeBaseContestedIndexRegistrationFee: 500,
      tokenRegistrationFee: 200,
      tokenUsesPerpetualDistributionFee: 300,
      tokenUsesPreProgrammedDistributionFee: 400,
      searchKeywordFee: 50,
    };
    const result = estimateContractFee({ documentSchemas: {} }, custom);
    expect(result.totalCredits).toBe(1000);
    expect(result.constants).toBe(custom);
  });

  it('accepts pre-parsed contract', () => {
    const parsed: ParsedContract = {
      documentTypes: [
        { name: 'doc1', indexes: [{ name: 'idx1', unique: true, contested: false }] },
      ],
      tokens: [],
      keywords: [],
    };
    const result = estimateContractFee(parsed);
    // base: 10B + 1 doc: 2B + 1 unique: 1B = 13B
    expect(result.totalCredits).toBe(13_000_000_000);
  });

  it('returns totalDash correctly', () => {
    const result = estimateContractFee({ documentSchemas: {} });
    expect(result.totalDash).toBe(result.totalCredits / CREDITS_PER_DASH);
  });

  it('line items sum to totalCredits', () => {
    const contract = {
      documentSchemas: {
        a: {
          type: 'object',
          indices: [
            { name: 'i1', properties: [{ x: 'asc' }], unique: true },
            { name: 'i2', properties: [{ y: 'asc' }] },
          ],
        },
      },
      tokens: { '0': { distributionRules: { perpetualDistribution: {} } } },
      keywords: ['test'],
    };
    const result = estimateContractFee(contract);
    const sum = result.lineItems.reduce((s, i) => s + i.totalCostCredits, 0);
    expect(sum).toBe(result.totalCredits);
  });
});
