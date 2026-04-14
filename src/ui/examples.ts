export interface Example {
  name: string;
  description: string;
  json: object;
}

export const EXAMPLES: Example[] = [
  {
    name: 'DPNS (Dash Platform Name Service)',
    description: '2 document types, 1 contested index, 1 unique, 1 non-unique',
    json: {
      documentSchemas: {
        domain: {
          documentsMutable: false,
          canBeDeleted: true,
          transferable: 1,
          tradeMode: 1,
          type: 'object',
          indices: [
            {
              name: 'parentNameAndLabel',
              properties: [
                { normalizedParentDomainName: 'asc' },
                { normalizedLabel: 'asc' },
              ],
              unique: true,
              contested: {
                fieldMatches: [
                  { field: 'normalizedLabel', regexPattern: '^[a-zA-Z01]{3,19}$' },
                ],
                resolution: 0,
                description: 'If the normalized label part of this index is less than 20 characters then a masternode vote contest takes place to give out the name',
              },
            },
            {
              name: 'identityId',
              nullSearchable: false,
              properties: [{ 'records.identity': 'asc' }],
            },
          ],
          properties: {
            label: { type: 'string', maxLength: 63 },
            normalizedLabel: { type: 'string', maxLength: 63 },
            normalizedParentDomainName: { type: 'string', maxLength: 63 },
            preorderSalt: { type: 'array', byteArray: true, minItems: 32, maxItems: 32 },
            records: {
              type: 'object',
              properties: {
                identity: { type: 'array', byteArray: true, minItems: 32, maxItems: 32 },
              },
            },
            subdomainRules: {
              type: 'object',
              properties: { allowSubdomains: { type: 'boolean' } },
            },
          },
          required: ['label', 'normalizedLabel', 'normalizedParentDomainName', 'preorderSalt', 'records', 'subdomainRules'],
          additionalProperties: false,
        },
        preorder: {
          documentsMutable: false,
          canBeDeleted: true,
          type: 'object',
          indices: [
            {
              name: 'saltedHash',
              properties: [{ saltedDomainHash: 'asc' }],
              unique: true,
            },
          ],
          properties: {
            saltedDomainHash: { type: 'array', byteArray: true, minItems: 32, maxItems: 32 },
          },
          required: ['saltedDomainHash'],
          additionalProperties: false,
        },
      },
    },
  },
  {
    name: 'Token Contract',
    description: '1 token with perpetual distribution, no document types',
    json: {
      documentSchemas: {},
      tokens: {
        '0': {
          conventions: {
            localizations: {
              en: { shouldCapitalize: true, singularForm: 'token', pluralForm: 'tokens' },
            },
            decimals: 8,
          },
          baseSupply: 10000000000,
          maxSupply: 50000000000,
          transferable: true,
          distributionRules: {
            perpetualDistribution: {
              distributionType: 'fixedAmount',
              distributionAmount: 1000,
            },
          },
        },
      },
    },
  },
  {
    name: 'Full-Featured Contract',
    description: 'Document types + tokens + keywords',
    json: {
      documentSchemas: {
        profile: {
          type: 'object',
          indices: [
            { name: 'byUsername', properties: [{ username: 'asc' }], unique: true },
            { name: 'byCreated', properties: [{ createdAt: 'asc' }] },
          ],
          properties: {
            username: { type: 'string', maxLength: 32 },
            displayName: { type: 'string', maxLength: 64 },
            bio: { type: 'string', maxLength: 256 },
          },
          required: ['username'],
        },
        post: {
          type: 'object',
          indices: [
            { name: 'byAuthor', properties: [{ authorId: 'asc' }] },
            { name: 'byTimestamp', properties: [{ timestamp: 'asc' }] },
          ],
          properties: {
            authorId: { type: 'array', byteArray: true },
            content: { type: 'string', maxLength: 1024 },
            timestamp: { type: 'integer' },
          },
          required: ['authorId', 'content', 'timestamp'],
        },
      },
      tokens: {
        '0': {
          conventions: {
            localizations: {
              en: { singularForm: 'reward', pluralForm: 'rewards' },
            },
            decimals: 8,
          },
          baseSupply: 1000000000,
          transferable: true,
          distributionRules: {
            perpetualDistribution: { distributionType: 'fixedAmount', distributionAmount: 100 },
            preProgrammedDistribution: { distributions: {} },
          },
        },
      },
      keywords: ['social', 'profile', 'messaging'],
    },
  },
];
