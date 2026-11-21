import type { FeeConstants } from './types';

/** Bundled fee constants (v3.rs, Platform v5.0.3) - auto-updated by CI */
export const DEFAULT_FEE_CONSTANTS: FeeConstants = {
  baseContractRegistrationFee: 10_000_000_000, // 0.1 Dash
  documentTypeRegistrationFee: 2_000_000_000, // 0.02 Dash
  documentTypeBaseNonUniqueIndexRegistrationFee: 1_000_000_000, // 0.01 Dash
  documentTypeBaseUniqueIndexRegistrationFee: 1_000_000_000, // 0.01 Dash
  documentTypeBaseContestedIndexRegistrationFee: 100_000_000_000, // 1 Dash
  tokenRegistrationFee: 10_000_000_000, // 0.1 Dash
  tokenUsesPerpetualDistributionFee: 10_000_000_000, // 0.1 Dash
  tokenUsesPreProgrammedDistributionFee: 10_000_000_000, // 0.1 Dash
  tokenUsesOncePerIdentityDistributionFee: 10_000_000_000, // 0.1 Dash
  searchKeywordFee: 10_000_000_000, // 0.1 Dash
};

export const BUNDLED_FEE_TABLE = {
  version: 'v3.rs',
  tag: 'v5.0.3',
  revision: '5e9aff1c4835299773095494a7a1c53506d5b0f9',
  sourceDate: '3 Nov 2026',
};

export const FEE_CONSTANTS_PATH = 'packages/rs-platform-version/src/version/fee/data_contract_registration';

/** Raw fee files at the pinned Platform release */
export const FEE_CONSTANTS_BASE_URL =
  'https://raw.githubusercontent.com/dashpay/platform/v5.0.3/packages/rs-platform-version/src/version/fee/data_contract_registration';

/** GitHub blob URL for linking to source (not raw) */
export const FEE_CONSTANTS_BLOB_BASE_URL =
  'https://github.com/dashpay/platform/blob/v5.0.3/packages/rs-platform-version/src/version/fee/data_contract_registration';
