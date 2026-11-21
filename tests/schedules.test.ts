import { describe, expect, it } from 'vitest';
import { BUNDLED_SCHEDULES, scheduleForProtocol, scheduleLabel } from '../src/lib/schedules';
import { estimateContractFee } from '../src/lib/estimator';
import { parseContractJson } from '../src/lib/parser';
import { EXAMPLES } from '../src/ui/examples';
import { BUNDLED_FEE_TABLE, DEFAULT_FEE_CONSTANTS } from '../src/lib/constants';
import { PLATFORM_V5_0_3 } from './fixtures/platform-v5.0.3';

describe('network fee schedules', () => {
  it('selects the historical and current protocol boundaries', () => {
    expect([1, 8, 9, 13, 14].map(scheduleForProtocol)).toEqual(['v1.rs', 'v1.rs', 'v2.rs', 'v2.rs', 'v3.rs']);
    for (const version of [0, -1, 13.5, 16, NaN]) expect(scheduleForProtocol(version)).toBeNull();
  });
  it('keeps protocol 15 (Platform 5.1) on the v3 registration table', () => {
    expect(scheduleForProtocol(15)).toBe('v3.rs');
    expect(scheduleLabel('v3.rs')).toBe('v3 · protocols 14–15');
    const tokens = { tokens: { '0': { distributionRules: { oncePerIdentityDistribution: {} } } } };
    expect(BUNDLED_SCHEDULES[scheduleForProtocol(15)!]).toBe(BUNDLED_SCHEDULES[scheduleForProtocol(14)!]);
    expect(estimateContractFee(tokens, PLATFORM_V5_0_3.v3).totalCredits).toBe(30_000_000_000);
  });
  it('retains the protocol 14 surcharge only in v3', () => {
    expect(BUNDLED_SCHEDULES['v2.rs'].tokenUsesOncePerIdentityDistributionFee).toBeUndefined();
    expect(BUNDLED_SCHEDULES['v3.rs'].tokenUsesOncePerIdentityDistributionFee).toEqual(expect.any(Number));
  });
  it('bundles the newest table as the v3 schedule, so a new table file needs a mapping review', () => {
    expect(BUNDLED_FEE_TABLE.version).toBe('v3.rs');
    expect(BUNDLED_SCHEDULES['v3.rs']).toBe(DEFAULT_FEE_CONSTANTS);
  });
  it('leads with a useful first contract below the one-tDASH starter allowance', () => {
    const parsed = parseContractJson(EXAMPLES[0].json);
    const result = estimateContractFee(parsed, BUNDLED_SCHEDULES['v2.rs']);
    expect(parsed.documentTypes).toHaveLength(1);
    expect(result.totalDash).toBe(0.12);
    expect(result.totalDash).toBeLessThan(1);
  });
});
