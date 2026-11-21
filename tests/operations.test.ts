import { describe, expect, it } from 'vitest';
import { estimateDocumentActivity, wholeNumber } from '../src/lib/operations';

describe('document activity', () => {
  it('prices a write from storage, processing, load and one signature', () => {
    expect(estimateDocumentActivity(1024, 1000, 100)).toEqual({ perWrite: 28_093_580, credits: 30_902_938_000 });
  });
  it('applies the operation minimum and rejects invalid input', () => {
    expect(estimateDocumentActivity(1, 1, 0)?.perWrite).toBe(100_000);
    expect(estimateDocumentActivity(0, 1, 0)).toBeNull();
    expect(wholeNumber('1.5')).toBeNull();
    expect(wholeNumber('0', 1)).toBeNull();
  });
});
