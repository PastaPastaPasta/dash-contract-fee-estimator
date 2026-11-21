export function encodeContractHandoff(json: string): string {
  const ascii = json.replace(/[^\x00-\x7f]/g, (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`);
  return btoa(ascii).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function fetchContract(id: string, network: string): Promise<unknown> {
  if (!/^[1-9A-HJ-NP-Za-km-z]{43,44}$/.test(id)) throw new Error('Use the base58 contract ID from Explorer.');
  if (network !== 'mainnet' && network !== 'testnet') throw new Error('Contract lookup supports Mainnet and Testnet. Choose the network in the bar.');
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([
      (async () => {
        const { EvoSDK } = await import('@dashevo/evo-sdk');
        const sdk = new EvoSDK({ network, trusted: true, settings: { timeoutMs: 4000, connectTimeoutMs: 4000, retries: 1 } });
        await sdk.connect();
        const contract = await sdk.contracts.fetch(id);
        if (!contract) throw new Error(`Contract not found on ${network === 'mainnet' ? 'Mainnet' : 'Testnet'}. Check the ID and network.`);
        return contract.toJSON(sdk.version());
      })(),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Platform did not answer within 18 seconds. Try loading the contract again.')), 18000); }),
    ]);
  } finally { clearTimeout(timer!); }
}
