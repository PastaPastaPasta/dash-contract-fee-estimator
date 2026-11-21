import { BUNDLED_FEE_TABLE } from './constants';

/** Per-write storage and processing constants from rs-platform-version fee/{storage,signature,state_transition_min_fees}/v1.rs */
export const OPERATION_FEES = {
  diskPerByte: 27000,
  processingPerByte: 400,
  loadPerByte: 20,
  signature: 15500,
  minimum: 100000,
} as const;

export const operationSource = (part: 'storage' | 'signature' | 'state_transition_min_fees') =>
  `https://github.com/dashpay/platform/blob/${BUNDLED_FEE_TABLE.tag}/packages/rs-platform-version/src/version/fee/${part}/v1.rs`;

export function wholeNumber(value: string, minimum = 0): number | null {
  if (!/^\d+$/.test(value)) return null;
  const n = Number(value);
  return Number.isSafeInteger(n) && n >= minimum ? n : null;
}

export function estimateDocumentActivity(bytes: number, creates: number, updates: number) {
  if (![bytes, creates, updates].every((n) => Number.isSafeInteger(n) && n >= 0) || bytes === 0) return null;
  const perWrite = Math.max(
    OPERATION_FEES.minimum,
    bytes * (OPERATION_FEES.diskPerByte + OPERATION_FEES.processingPerByte + OPERATION_FEES.loadPerByte) +
      OPERATION_FEES.signature,
  );
  const credits = perWrite * (creates + updates);
  if (!Number.isSafeInteger(perWrite) || !Number.isSafeInteger(credits)) return null;
  return { perWrite, credits };
}
