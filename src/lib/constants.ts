import type { FeeConstants } from './types';

/** Bundled fee constants from protocol version 9 (Dash 2.0) - auto-updated by CI */
export const DEFAULT_FEE_CONSTANTS: FeeConstants = {
  baseContractRegistrationFee: 10_000_000_000, // 0.1 Dash
  documentTypeRegistrationFee: 2_000_000_000, // 0.02 Dash
  documentTypeBaseNonUniqueIndexRegistrationFee: 1_000_000_000, // 0.01 Dash
  documentTypeBaseUniqueIndexRegistrationFee: 1_000_000_000, // 0.01 Dash
  documentTypeBaseContestedIndexRegistrationFee: 100_000_000_000, // 1.0 Dash
  tokenRegistrationFee: 10_000_000_000, // 0.1 Dash
  tokenUsesPerpetualDistributionFee: 10_000_000_000, // 0.1 Dash
  tokenUsesPreProgrammedDistributionFee: 10_000_000_000, // 0.1 Dash
  searchKeywordFee: 10_000_000_000, // 0.1 Dash
};

/** Source URL for fetching latest fee constants from DPP */
export const FEE_CONSTANTS_SOURCE_URL =
  'https://raw.githubusercontent.com/dashpay/platform/master/packages/rs-platform-version/src/version/fee/data_contract_registration/v2.rs';
