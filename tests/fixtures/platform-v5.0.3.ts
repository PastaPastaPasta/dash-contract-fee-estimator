import type { FeeConstants } from '../../src/lib/types';

export const PLATFORM_V5_0_3 = {
  tag: 'v5.0.3',
  revision: '5e9aff1c4835299773095494a7a1c53506d5b0f9',
  committedAt: '2026-11-04T00:43:26+07:00',
  sourceDate: '3 Nov 2026',
  v3: {
    baseContractRegistrationFee: 10_000_000_000,
    documentTypeRegistrationFee: 2_000_000_000,
    documentTypeBaseNonUniqueIndexRegistrationFee: 1_000_000_000,
    documentTypeBaseUniqueIndexRegistrationFee: 1_000_000_000,
    documentTypeBaseContestedIndexRegistrationFee: 100_000_000_000,
    tokenRegistrationFee: 10_000_000_000,
    tokenUsesPerpetualDistributionFee: 10_000_000_000,
    tokenUsesPreProgrammedDistributionFee: 10_000_000_000,
    tokenUsesOncePerIdentityDistributionFee: 10_000_000_000,
    searchKeywordFee: 10_000_000_000,
  } satisfies FeeConstants,
};
