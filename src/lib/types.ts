/** 1 Dash = 100,000,000,000 credits */
export const CREDITS_PER_DASH = 100_000_000_000;

/** Fee constants matching FeeDataContractRegistrationVersion in rs-platform-version */
export interface FeeConstants {
  baseContractRegistrationFee: number;
  documentTypeRegistrationFee: number;
  documentTypeBaseNonUniqueIndexRegistrationFee: number;
  documentTypeBaseUniqueIndexRegistrationFee: number;
  documentTypeBaseContestedIndexRegistrationFee: number;
  tokenRegistrationFee: number;
  tokenUsesPerpetualDistributionFee: number;
  tokenUsesPreProgrammedDistributionFee: number;
  searchKeywordFee: number;
}

/** Individual line item in the fee breakdown */
export interface FeeLineItem {
  label: string;
  description: string;
  count: number;
  unitCostCredits: number;
  totalCostCredits: number;
}

/** Complete fee estimate result */
export interface FeeEstimate {
  totalCredits: number;
  totalDash: number;
  lineItems: FeeLineItem[];
  constants: FeeConstants;
}

/** Parsed index info */
export interface IndexInfo {
  name: string;
  unique: boolean;
  contested: boolean;
}

/** Parsed document type info */
export interface DocumentTypeInfo {
  name: string;
  indexes: IndexInfo[];
}

/** Parsed token info */
export interface TokenInfo {
  position: string;
  hasPerpetualDistribution: boolean;
  hasPreProgrammedDistribution: boolean;
}

/** Intermediate parsed representation of a contract */
export interface ParsedContract {
  documentTypes: DocumentTypeInfo[];
  tokens: TokenInfo[];
  keywords: string[];
}
