import { DEFAULT_FEE_CONSTANTS } from './constants';
import type { FeeConstants } from './types';

const v2: FeeConstants = {
  baseContractRegistrationFee: 10_000_000_000,
  documentTypeRegistrationFee: 2_000_000_000,
  documentTypeBaseNonUniqueIndexRegistrationFee: 1_000_000_000,
  documentTypeBaseUniqueIndexRegistrationFee: 1_000_000_000,
  documentTypeBaseContestedIndexRegistrationFee: 100_000_000_000,
  tokenRegistrationFee: 10_000_000_000,
  tokenUsesPerpetualDistributionFee: 10_000_000_000,
  tokenUsesPreProgrammedDistributionFee: 10_000_000_000,
  searchKeywordFee: 10_000_000_000,
};

export const BUNDLED_SCHEDULES: Record<string, FeeConstants> = {
  'v1.rs': { ...v2, ...Object.fromEntries(Object.keys(v2).map(key => [key, 0])), tokenUsesOncePerIdentityDistributionFee: 0 },
  'v2.rs': v2,
  'v3.rs': DEFAULT_FEE_CONSTANTS,
};

export function scheduleForProtocol(protocol: number): string | null {
  if (!Number.isInteger(protocol) || protocol < 1 || protocol > 14) return null;
  return protocol >= 14 ? 'v3.rs' : protocol >= 9 ? 'v2.rs' : 'v1.rs';
}

export function scheduleLabel(version: string): string {
  return version === 'v3.rs' ? 'v3 · protocol 14' : version === 'v2.rs' ? 'v2 · protocols 9–13' : version === 'v1.rs' ? 'v1 · protocols 1–8 (historical)' : `${version} · applicability unconfirmed`;
}

export async function readCurrentProtocol(network: string): Promise<number> {
  if (network !== 'mainnet' && network !== 'testnet') throw new Error('Choose Mainnet or Testnet.');
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([
      (async () => {
        const { EvoSDK } = await import('@dashevo/evo-sdk');
        const sdk = new EvoSDK({ network, trusted: true, settings: { timeoutMs: 4000, connectTimeoutMs: 4000, retries: 1 } });
        await sdk.connect();
        const status = await sdk.system.status();
        const protocol = Number(status.version.protocol.drive.current);
        if (!Number.isInteger(protocol) || protocol < 1) throw new Error('Platform returned no current protocol.');
        return protocol;
      })(),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Platform did not answer in 18 seconds.')), 18000); }),
    ]);
  } finally { clearTimeout(timer!); }
}
