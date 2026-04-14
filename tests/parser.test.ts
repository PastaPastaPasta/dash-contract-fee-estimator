import { describe, it, expect } from 'vitest';
import { parseContractJson } from '../src/lib/parser';
import dpnsContract from './fixtures/dpns-contract.json';
import dpnsContestedContract from './fixtures/dpns-contract-contested-unique-index.json';
import tokenContract from './fixtures/token-example-contract.json';

describe('parseContractJson', () => {
  it('parses standard contract with documentSchemas', () => {
    const parsed = parseContractJson(dpnsContract);
    expect(parsed.documentTypes).toHaveLength(2);
    expect(parsed.documentTypes.map((d) => d.name).sort()).toEqual(['domain', 'preorder']);
  });

  it('parses document type indexes correctly', () => {
    const parsed = parseContractJson(dpnsContract);
    const domain = parsed.documentTypes.find((d) => d.name === 'domain')!;
    expect(domain.indexes).toHaveLength(3);

    const parentNameAndLabel = domain.indexes.find((i) => i.name === 'parentNameAndLabel')!;
    expect(parentNameAndLabel.unique).toBe(true);
    expect(parentNameAndLabel.contested).toBe(false);

    const dashAlias = domain.indexes.find((i) => i.name === 'dashAlias')!;
    expect(dashAlias.unique).toBe(false);
    expect(dashAlias.contested).toBe(false);
  });

  it('parses contested indexes', () => {
    const parsed = parseContractJson(dpnsContestedContract);
    const domain = parsed.documentTypes.find((d) => d.name === 'domain')!;
    const contested = domain.indexes.find((i) => i.name === 'parentNameAndLabel')!;
    expect(contested.contested).toBe(true);
    expect(contested.unique).toBe(true);
  });

  it('parses tokens', () => {
    const parsed = parseContractJson(tokenContract);
    expect(parsed.tokens).toHaveLength(1);
    expect(parsed.tokens[0].position).toBe('0');
  });

  it('parses token distribution rules', () => {
    const contract = {
      documentSchemas: {},
      tokens: {
        '0': {
          distributionRules: {
            perpetualDistribution: { config: true },
            preProgrammedDistribution: null,
          },
        },
        '1': {
          distributionRules: {
            perpetualDistribution: null,
            preProgrammedDistribution: { distributions: {} },
          },
        },
      },
    };
    const parsed = parseContractJson(contract);
    expect(parsed.tokens[0].hasPerpetualDistribution).toBe(true);
    expect(parsed.tokens[0].hasPreProgrammedDistribution).toBe(false);
    expect(parsed.tokens[1].hasPerpetualDistribution).toBe(false);
    expect(parsed.tokens[1].hasPreProgrammedDistribution).toBe(true);
  });

  it('parses keywords', () => {
    const contract = {
      documentSchemas: {},
      keywords: ['defi', 'payments'],
    };
    const parsed = parseContractJson(contract);
    expect(parsed.keywords).toEqual(['defi', 'payments']);
  });

  it('handles missing optional fields', () => {
    const parsed = parseContractJson({ documentSchemas: {} });
    expect(parsed.documentTypes).toHaveLength(0);
    expect(parsed.tokens).toHaveLength(0);
    expect(parsed.keywords).toHaveLength(0);
  });

  it('accepts document-only format (no documentSchemas wrapper)', () => {
    const docOnly = {
      profile: {
        type: 'object',
        indices: [{ name: 'byName', properties: [{ name: 'asc' }], unique: true }],
        properties: { name: { type: 'string' } },
      },
    };
    const parsed = parseContractJson(docOnly);
    expect(parsed.documentTypes).toHaveLength(1);
    expect(parsed.documentTypes[0].name).toBe('profile');
    expect(parsed.documentTypes[0].indexes).toHaveLength(1);
  });

  it('throws on non-object input', () => {
    expect(() => parseContractJson(null)).toThrow('Contract must be a JSON object');
    expect(() => parseContractJson('string')).toThrow('Contract must be a JSON object');
    expect(() => parseContractJson([])).toThrow('Contract must be a JSON object');
  });

  it('handles document types with no indices', () => {
    const contract = {
      documentSchemas: {
        simple: { type: 'object', properties: { name: { type: 'string' } } },
      },
    };
    const parsed = parseContractJson(contract);
    expect(parsed.documentTypes[0].indexes).toHaveLength(0);
  });

  it('handles tokens with no distributionRules', () => {
    const parsed = parseContractJson(tokenContract);
    expect(parsed.tokens[0].hasPerpetualDistribution).toBe(false);
    expect(parsed.tokens[0].hasPreProgrammedDistribution).toBe(false);
  });
});
