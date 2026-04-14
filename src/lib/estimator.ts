import { DEFAULT_FEE_CONSTANTS } from './constants';
import { parseContractJson } from './parser';
import type { FeeConstants, FeeEstimate, FeeLineItem, ParsedContract } from './types';
import { CREDITS_PER_DASH } from './types';

/**
 * Estimate the registration fee for a Dash Platform data contract.
 * Mirrors `registration_cost_v1` from rs-dpp.
 *
 * @param contract - Either a raw contract JSON object or a pre-parsed ParsedContract
 * @param constants - Optional fee constants override (defaults to bundled v2 constants)
 */
export function estimateContractFee(
  contract: ParsedContract | Record<string, unknown>,
  constants: FeeConstants = DEFAULT_FEE_CONSTANTS,
): FeeEstimate {
  const parsed = isParsedContract(contract) ? contract : parseContractJson(contract);
  const lineItems: FeeLineItem[] = [];

  // Base contract registration fee
  lineItems.push({
    label: 'Base registration',
    description: 'Base fee for registering a data contract',
    count: 1,
    unitCostCredits: constants.baseContractRegistrationFee,
    totalCostCredits: constants.baseContractRegistrationFee,
  });

  // Document type fees
  if (parsed.documentTypes.length > 0) {
    lineItems.push({
      label: 'Document types',
      description: `${parsed.documentTypes.map((d) => d.name).join(', ')}`,
      count: parsed.documentTypes.length,
      unitCostCredits: constants.documentTypeRegistrationFee,
      totalCostCredits: parsed.documentTypes.length * constants.documentTypeRegistrationFee,
    });
  }

  // Index fees - group by type
  let uniqueCount = 0;
  let nonUniqueCount = 0;
  let contestedCount = 0;

  for (const docType of parsed.documentTypes) {
    for (const index of docType.indexes) {
      // Contested takes priority (matches Rust: contested check first, then unique)
      if (index.contested) {
        contestedCount++;
      } else if (index.unique) {
        uniqueCount++;
      } else {
        nonUniqueCount++;
      }
    }
  }

  if (uniqueCount > 0) {
    lineItems.push({
      label: 'Unique indexes',
      description: 'Per unique index on document types',
      count: uniqueCount,
      unitCostCredits: constants.documentTypeBaseUniqueIndexRegistrationFee,
      totalCostCredits: uniqueCount * constants.documentTypeBaseUniqueIndexRegistrationFee,
    });
  }

  if (nonUniqueCount > 0) {
    lineItems.push({
      label: 'Non-unique indexes',
      description: 'Per non-unique index on document types',
      count: nonUniqueCount,
      unitCostCredits: constants.documentTypeBaseNonUniqueIndexRegistrationFee,
      totalCostCredits: nonUniqueCount * constants.documentTypeBaseNonUniqueIndexRegistrationFee,
    });
  }

  if (contestedCount > 0) {
    lineItems.push({
      label: 'Contested indexes',
      description: 'Per contested unique index (requires masternode voting)',
      count: contestedCount,
      unitCostCredits: constants.documentTypeBaseContestedIndexRegistrationFee,
      totalCostCredits: contestedCount * constants.documentTypeBaseContestedIndexRegistrationFee,
    });
  }

  // Token fees
  if (parsed.tokens.length > 0) {
    lineItems.push({
      label: 'Tokens',
      description: 'Per token registration',
      count: parsed.tokens.length,
      unitCostCredits: constants.tokenRegistrationFee,
      totalCostCredits: parsed.tokens.length * constants.tokenRegistrationFee,
    });

    const perpetualCount = parsed.tokens.filter((t) => t.hasPerpetualDistribution).length;
    if (perpetualCount > 0) {
      lineItems.push({
        label: 'Perpetual distribution',
        description: 'Per token using perpetual distribution',
        count: perpetualCount,
        unitCostCredits: constants.tokenUsesPerpetualDistributionFee,
        totalCostCredits: perpetualCount * constants.tokenUsesPerpetualDistributionFee,
      });
    }

    const preProgrammedCount = parsed.tokens.filter((t) => t.hasPreProgrammedDistribution).length;
    if (preProgrammedCount > 0) {
      lineItems.push({
        label: 'Pre-programmed distribution',
        description: 'Per token using pre-programmed distribution',
        count: preProgrammedCount,
        unitCostCredits: constants.tokenUsesPreProgrammedDistributionFee,
        totalCostCredits: preProgrammedCount * constants.tokenUsesPreProgrammedDistributionFee,
      });
    }
  }

  // Keyword fees
  if (parsed.keywords.length > 0) {
    lineItems.push({
      label: 'Search keywords',
      description: 'Per search keyword on the contract',
      count: parsed.keywords.length,
      unitCostCredits: constants.searchKeywordFee,
      totalCostCredits: parsed.keywords.length * constants.searchKeywordFee,
    });
  }

  const totalCredits = lineItems.reduce((sum, item) => sum + item.totalCostCredits, 0);

  return {
    totalCredits,
    totalDash: totalCredits / CREDITS_PER_DASH,
    lineItems,
    constants,
  };
}

function isParsedContract(obj: unknown): obj is ParsedContract {
  if (!obj || typeof obj !== 'object') return false;
  const o = obj as Record<string, unknown>;
  return Array.isArray(o.documentTypes) && Array.isArray(o.tokens) && Array.isArray(o.keywords);
}
