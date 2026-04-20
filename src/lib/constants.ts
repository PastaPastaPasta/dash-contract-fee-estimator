import type { FeeConstants } from './types';

/** Bundled fee constants (v2.rs) - auto-updated by CI */
export const DEFAULT_FEE_CONSTANTS: FeeConstants = {
  baseContractRegistrationFee: 10_000_000_000, // 0.1 Dash
  documentTypeRegistrationFee: 2_000_000_000, // 0.02 Dash
  documentTypeBaseNonUniqueIndexRegistrationFee: 1_000_000_000, // 0.01 Dash
  documentTypeBaseUniqueIndexRegistrationFee: 1_000_000_000, // 0.01 Dash
  documentTypeBaseContestedIndexRegistrationFee: 100_000_000_000, // 1 Dash
  tokenRegistrationFee: 10_000_000_000, // 0.1 Dash
  tokenUsesPerpetualDistributionFee: 10_000_000_000, // 0.1 Dash
  tokenUsesPreProgrammedDistributionFee: 10_000_000_000, // 0.1 Dash
  searchKeywordFee: 10_000_000_000, // 0.1 Dash
};

/** Base directory URL for fee constant source files in DPP */
export const FEE_CONSTANTS_BASE_URL =
  'https://raw.githubusercontent.com/dashpay/platform/master/packages/rs-platform-version/src/version/fee/data_contract_registration';

/** GitHub blob URL for linking to source (not raw) */
export const FEE_CONSTANTS_BLOB_BASE_URL =
  'https://github.com/dashpay/platform/blob/master/packages/rs-platform-version/src/version/fee/data_contract_registration';
