import { expect, it } from 'vitest';
import { encodeContractHandoff } from '../src/lib/contract-source';

it('preserves non-ASCII schema text through the Bridge base64 JSON decoder', () => {
  const schema = { description: 'café 日本語 🚀', documentSchemas: {} };
  const encoded = encodeContractHandoff(JSON.stringify(schema));
  expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
  expect(JSON.parse(atob(encoded.replace(/-/g, '+').replace(/_/g, '/')))).toEqual(schema);
});
