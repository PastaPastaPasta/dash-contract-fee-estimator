import type { ParsedContract, DocumentTypeInfo, IndexInfo, TokenInfo } from './types';

/**
 * Parse a data contract JSON into a fee-relevant structure.
 * Accepts either the full contract format (with `documentSchemas` key)
 * or the document-only format (top-level keys are document type names).
 */
export function parseContractJson(json: unknown): ParsedContract {
  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    throw new Error('Contract must be a JSON object');
  }

  const obj = json as Record<string, unknown>;

  const documentSchemas = resolveDocumentSchemas(obj);
  const documentTypes = parseDocumentTypes(documentSchemas);
  const tokens = parseTokens(obj.tokens);
  const keywords = parseKeywords(obj.keywords);

  return { documentTypes, tokens, keywords };
}

function resolveDocumentSchemas(
  obj: Record<string, unknown>,
): Record<string, unknown> {
  // Full contract format: has documentSchemas key
  if (obj.documentSchemas && typeof obj.documentSchemas === 'object') {
    return obj.documentSchemas as Record<string, unknown>;
  }

  // Document-only format: top-level keys are document type names
  // Detect by checking if any value looks like a document type schema
  const candidates = Object.entries(obj).filter(([key, val]) => {
    if (key.startsWith('$') || key === 'id' || key === 'ownerId' || key === 'version') {
      return false;
    }
    if (!val || typeof val !== 'object') return false;
    const v = val as Record<string, unknown>;
    return v.type === 'object' || Array.isArray(v.indices);
  });

  if (candidates.length > 0) {
    return Object.fromEntries(candidates);
  }

  // No document types found - valid contract with no documents
  return {};
}

function parseDocumentTypes(
  schemas: Record<string, unknown>,
): DocumentTypeInfo[] {
  return Object.entries(schemas).map(([name, schema]) => {
    const indexes = parseIndexes(schema);
    return { name, indexes };
  });
}

function parseIndexes(schema: unknown): IndexInfo[] {
  if (!schema || typeof schema !== 'object') return [];
  const s = schema as Record<string, unknown>;
  const indices = s.indices;
  if (!Array.isArray(indices)) return [];

  return indices
    .filter((idx): idx is Record<string, unknown> => !!idx && typeof idx === 'object')
    .map((idx) => ({
      name: typeof idx.name === 'string' ? idx.name : 'unnamed',
      unique: idx.unique === true,
      contested: !!idx.contested && typeof idx.contested === 'object',
    }));
}

function parseTokens(tokens: unknown): TokenInfo[] {
  if (!tokens || typeof tokens !== 'object' || Array.isArray(tokens)) return [];

  return Object.entries(tokens as Record<string, unknown>).map(([position, config]) => {
    const cfg = (config && typeof config === 'object' ? config : {}) as Record<string, unknown>;

    // Distribution rules may be under distributionRules (camelCase from Rust serde)
    const distRules = (cfg.distributionRules &&
      typeof cfg.distributionRules === 'object'
      ? cfg.distributionRules
      : {}) as Record<string, unknown>;

    return {
      position,
      hasPerpetualDistribution: distRules.perpetualDistribution != null,
      hasPreProgrammedDistribution: distRules.preProgrammedDistribution != null,
    };
  });
}

function parseKeywords(keywords: unknown): string[] {
  if (!Array.isArray(keywords)) return [];
  return keywords.filter((k): k is string => typeof k === 'string');
}
