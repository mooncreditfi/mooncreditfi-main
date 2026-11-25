// Generated from mooncreditfi.json using Anchor's camel-case IDL normalization.
const idl = {
  address: "6LVAYFDRrTHSiHZqMWr4tybZNRi755HsoHgeku985pYx",
  metadata: {
    name: "mooncreditfi",
    version: "0.1.0",
    spec: "0.1.0",
  },
  instructions: [
    {
      name: "initializePlatform",
      discriminator: [119, 201, 101, 45, 75, 122, 89, 3],
      accounts: [
        {
          name: "config",
          writable: true,
          signer: false,
        },
        {
          name: "usdcMint",
          writable: false,
          signer: false,
        },
        {
          name: "authority",
          writable: true,
          signer: true,
        },
        {
          name: "systemProgram",
          writable: false,
          signer: false,
        },
      ],
      args: [],
    },
    {
      name: "registerEntrepreneur",
      discriminator: [152, 27, 77, 154, 157, 165, 106, 63],
      accounts: [
        {
          name: "entrepreneurProfile",
          writable: true,
          signer: false,
        },
        {
          name: "entrepreneur",
          writable: true,
          signer: true,
        },
        {
          name: "systemProgram",
          writable: false,
          signer: false,
        },
      ],
      args: [],
    },
    {
      name: "createProposal",
      discriminator: [132, 116, 68, 174, 216, 160, 198, 22],
      accounts: [
        {
          name: "entrepreneurProfile",
          writable: false,
          signer: false,
        },
        {
          name: "proposal",
          writable: true,
          signer: false,
        },
        {
          name: "entrepreneur",
          writable: true,
          signer: true,
        },
        {
          name: "systemProgram",
          writable: false,
          signer: false,
        },
      ],
      args: [
        {
          name: "businessId",
          type: {
            array: ["u8", 32],
          },
        },
        {
          name: "fundingGoal",
          type: "u64",
        },
        {
          name: "entrepreneurProfitBps",
          type: "u16",
        },
      ],
    },
    {
      name: "approveProposal",
      discriminator: [136, 108, 102, 85, 98, 114, 7, 147],
      accounts: [
        {
          name: "config",
          writable: false,
          signer: false,
        },
        {
          name: "proposal",
          writable: true,
          signer: false,
        },
        {
          name: "authority",
          writable: false,
          signer: true,
        },
      ],
      args: [],
    },
    {
      name: "createPool",
      discriminator: [233, 146, 209, 142, 207, 104, 64, 188],
      accounts: [
        {
          name: "config",
          writable: false,
          signer: false,
        },
        {
          name: "proposal",
          writable: false,
          signer: false,
        },
        {
          name: "pool",
          writable: true,
          signer: false,
        },
        {
          name: "vault",
          writable: true,
          signer: false,
        },
        {
          name: "usdcMint",
          writable: false,
          signer: false,
        },
        {
          name: "entrepreneur",
          writable: true,
          signer: true,
        },
        {
          name: "tokenProgram",
          writable: false,
          signer: false,
        },
        {
          name: "systemProgram",
          writable: false,
          signer: false,
        },
        {
          name: "rent",
          writable: false,
          signer: false,
        },
      ],
      args: [],
    },
    {
      name: "contribute",
      discriminator: [82, 33, 68, 131, 32, 0, 205, 95],
      accounts: [
        {
          name: "pool",
          writable: true,
          signer: false,
        },
        {
          name: "position",
          writable: true,
          signer: false,
        },
        {
          name: "investorTokenAccount",
          writable: true,
          signer: false,
        },
        {
          name: "vault",
          writable: true,
          signer: false,
        },
        {
          name: "usdcMint",
          writable: false,
          signer: false,
        },
        {
          name: "investor",
          writable: true,
          signer: true,
        },
        {
          name: "tokenProgram",
          writable: false,
          signer: false,
        },
        {
          name: "systemProgram",
          writable: false,
          signer: false,
        },
      ],
      args: [
        {
          name: "amount",
          type: "u64",
        },
      ],
    },
    {
      name: "activatePool",
      discriminator: [129, 125, 90, 174, 121, 169, 225, 239],
      accounts: [
        {
          name: "pool",
          writable: true,
          signer: false,
        },
        {
          name: "entrepreneur",
          writable: false,
          signer: true,
        },
      ],
      args: [],
    },
    {
      name: "disburseCapital",
      discriminator: [128, 6, 66, 243, 45, 65, 175, 207],
      accounts: [
        {
          name: "config",
          writable: false,
          signer: false,
        },
        {
          name: "pool",
          writable: true,
          signer: false,
        },
        {
          name: "vault",
          writable: true,
          signer: false,
        },
        {
          name: "usdcMint",
          writable: false,
          signer: false,
        },
        {
          name: "entrepreneurTokenAccount",
          writable: true,
          signer: false,
        },
        {
          name: "authority",
          writable: false,
          signer: true,
        },
        {
          name: "entrepreneur",
          writable: false,
          signer: true,
        },
        {
          name: "tokenProgram",
          writable: false,
          signer: false,
        },
      ],
      args: [],
    },
    {
      name: "submitSettlement",
      discriminator: [255, 231, 47, 245, 40, 161, 95, 231],
      accounts: [
        {
          name: "pool",
          writable: true,
          signer: false,
        },
        {
          name: "settlement",
          writable: true,
          signer: false,
        },
        {
          name: "vault",
          writable: true,
          signer: false,
        },
        {
          name: "usdcMint",
          writable: false,
          signer: false,
        },
        {
          name: "entrepreneurTokenAccount",
          writable: true,
          signer: false,
        },
        {
          name: "entrepreneur",
          writable: true,
          signer: true,
        },
        {
          name: "tokenProgram",
          writable: false,
          signer: false,
        },
        {
          name: "systemProgram",
          writable: false,
          signer: false,
        },
      ],
      args: [
        {
          name: "returnedAmount",
          type: "u64",
        },
      ],
    },
    {
      name: "approveSettlement",
      discriminator: [186, 5, 15, 163, 23, 10, 142, 12],
      accounts: [
        {
          name: "config",
          writable: false,
          signer: false,
        },
        {
          name: "pool",
          writable: true,
          signer: false,
        },
        {
          name: "settlement",
          writable: true,
          signer: false,
        },
        {
          name: "authority",
          writable: false,
          signer: true,
        },
      ],
      args: [],
    },
    {
      name: "claimDistribution",
      discriminator: [204, 156, 94, 85, 2, 125, 232, 180],
      accounts: [
        {
          name: "pool",
          writable: true,
          signer: false,
        },
        {
          name: "position",
          writable: true,
          signer: false,
        },
        {
          name: "vault",
          writable: true,
          signer: false,
        },
        {
          name: "usdcMint",
          writable: false,
          signer: false,
        },
        {
          name: "investorTokenAccount",
          writable: true,
          signer: false,
        },
        {
          name: "investor",
          writable: false,
          signer: true,
        },
        {
          name: "tokenProgram",
          writable: false,
          signer: false,
        },
      ],
      args: [],
    },
    {
      name: "claimEntrepreneurProfit",
      discriminator: [82, 239, 119, 7, 236, 148, 183, 36],
      accounts: [
        {
          name: "pool",
          writable: true,
          signer: false,
        },
        {
          name: "vault",
          writable: true,
          signer: false,
        },
        {
          name: "usdcMint",
          writable: false,
          signer: false,
        },
        {
          name: "entrepreneurTokenAccount",
          writable: true,
          signer: false,
        },
        {
          name: "entrepreneur",
          writable: false,
          signer: true,
        },
        {
          name: "tokenProgram",
          writable: false,
          signer: false,
        },
      ],
      args: [],
    },
    {
      name: "cancelPool",
      discriminator: [211, 11, 27, 100, 252, 115, 57, 77],
      accounts: [
        {
          name: "config",
          writable: false,
          signer: false,
        },
        {
          name: "pool",
          writable: true,
          signer: false,
        },
        {
          name: "authority",
          writable: false,
          signer: true,
        },
      ],
      args: [],
    },
    {
      name: "claimRefund",
      discriminator: [15, 16, 30, 161, 255, 228, 97, 60],
      accounts: [
        {
          name: "pool",
          writable: true,
          signer: false,
        },
        {
          name: "position",
          writable: true,
          signer: false,
        },
        {
          name: "vault",
          writable: true,
          signer: false,
        },
        {
          name: "usdcMint",
          writable: false,
          signer: false,
        },
        {
          name: "investorTokenAccount",
          writable: true,
          signer: false,
        },
        {
          name: "investor",
          writable: false,
          signer: true,
        },
        {
          name: "tokenProgram",
          writable: false,
          signer: false,
        },
      ],
      args: [],
    },
  ],
  accounts: [
    {
      name: "platformConfig",
      discriminator: [160, 78, 128, 0, 248, 83, 230, 160],
    },
    {
      name: "entrepreneurProfile",
      discriminator: [62, 224, 5, 54, 102, 163, 113, 215],
    },
    {
      name: "businessProposal",
      discriminator: [16, 221, 93, 159, 94, 141, 175, 20],
    },
    {
      name: "mudarabahPool",
      discriminator: [139, 195, 198, 208, 225, 164, 51, 88],
    },
    {
      name: "investorPosition",
      discriminator: [145, 143, 236, 150, 229, 40, 195, 88],
    },
    {
      name: "settlementRecord",
      discriminator: [172, 159, 67, 74, 96, 85, 37, 205],
    },
  ],
  events: [
    {
      name: "platformInitialized",
      discriminator: [16, 222, 212, 5, 213, 140, 112, 162],
    },
    {
      name: "entrepreneurRegistered",
      discriminator: [157, 5, 252, 220, 252, 170, 143, 139],
    },
    {
      name: "proposalCreated",
      discriminator: [186, 8, 160, 108, 81, 13, 51, 206],
    },
    {
      name: "proposalApproved",
      discriminator: [70, 49, 155, 228, 157, 43, 88, 49],
    },
    {
      name: "poolCreated",
      discriminator: [202, 44, 41, 88, 104, 220, 157, 82],
    },
    {
      name: "contributionMade",
      discriminator: [81, 218, 72, 109, 93, 96, 131, 199],
    },
    {
      name: "poolFunded",
      discriminator: [164, 221, 242, 68, 164, 64, 24, 214],
    },
    {
      name: "capitalDisbursed",
      discriminator: [146, 41, 200, 210, 255, 8, 104, 189],
    },
    {
      name: "settlementSubmitted",
      discriminator: [128, 245, 200, 67, 17, 89, 204, 82],
    },
    {
      name: "settlementApproved",
      discriminator: [11, 13, 1, 163, 187, 57, 161, 6],
    },
    {
      name: "investorClaimed",
      discriminator: [250, 242, 56, 218, 135, 41, 60, 247],
    },
    {
      name: "entrepreneurProfitClaimed",
      discriminator: [186, 252, 35, 153, 14, 207, 68, 201],
    },
    {
      name: "poolCancelled",
      discriminator: [204, 15, 86, 4, 124, 97, 170, 173],
    },
    {
      name: "investorRefunded",
      discriminator: [120, 193, 178, 19, 245, 11, 192, 48],
    },
  ],
  errors: [
    {
      code: 6000,
      name: "invalidAmount",
      msg: "The amount must be greater than zero.",
    },
    {
      code: 6001,
      name: "mathOverflow",
      msg: "Arithmetic overflow.",
    },
    {
      code: 6002,
      name: "invalidMint",
      msg: "The supplied mint is not the configured USDC mint.",
    },
    {
      code: 6003,
      name: "invalidMintDecimals",
      msg: "The mint must use six decimals.",
    },
    {
      code: 6004,
      name: "invalidProfitShare",
      msg: "The profit share must be between 0 and 10,000 basis points.",
    },
    {
      code: 6005,
      name: "unauthorized",
      msg: "The caller is not authorized for this action.",
    },
    {
      code: 6006,
      name: "alreadyApproved",
      msg: "The proposal has already been approved.",
    },
    {
      code: 6007,
      name: "proposalNotApproved",
      msg: "The proposal has not been approved.",
    },
    {
      code: 6008,
      name: "invalidPoolStatus",
      msg: "The pool is not in the required state.",
    },
    {
      code: 6009,
      name: "fundingGoalExceeded",
      msg: "The contribution would exceed the funding goal.",
    },
    {
      code: 6010,
      name: "fundingGoalNotReached",
      msg: "The pool has not reached its funding goal.",
    },
    {
      code: 6011,
      name: "alreadyClaimed",
      msg: "This investor has already claimed.",
    },
    {
      code: 6012,
      name: "investorClaimsPending",
      msg: "All investor claims must be completed first.",
    },
    {
      code: 6013,
      name: "invalidVault",
      msg: "The supplied vault is invalid.",
    },
  ],
  types: [
    {
      name: "platformConfig",
      type: {
        kind: "struct",
        fields: [
          {
            name: "authority",
            type: "pubkey",
          },
          {
            name: "usdcMint",
            type: "pubkey",
          },
          {
            name: "bump",
            type: "u8",
          },
        ],
      },
    },
    {
      name: "entrepreneurProfile",
      type: {
        kind: "struct",
        fields: [
          {
            name: "owner",
            type: "pubkey",
          },
          {
            name: "bump",
            type: "u8",
          },
        ],
      },
    },
    {
      name: "businessProposal",
      type: {
        kind: "struct",
        fields: [
          {
            name: "entrepreneur",
            type: "pubkey",
          },
          {
            name: "businessId",
            type: {
              array: ["u8", 32],
            },
          },
          {
            name: "fundingGoal",
            type: "u64",
          },
          {
            name: "entrepreneurProfitBps",
            type: "u16",
          },
          {
            name: "approved",
            type: "bool",
          },
          {
            name: "bump",
            type: "u8",
          },
        ],
      },
    },
    {
      name: "mudarabahPool",
      type: {
        kind: "struct",
        fields: [
          {
            name: "proposal",
            type: "pubkey",
          },
          {
            name: "entrepreneur",
            type: "pubkey",
          },
          {
            name: "mint",
            type: "pubkey",
          },
          {
            name: "vault",
            type: "pubkey",
          },
          {
            name: "fundingGoal",
            type: "u64",
          },
          {
            name: "totalContributed",
            type: "u64",
          },
          {
            name: "totalReturned",
            type: "u64",
          },
          {
            name: "entrepreneurProfitBps",
            type: "u16",
          },
          {
            name: "status",
            type: {
              defined: {
                name: "poolStatus",
              },
            },
          },
          {
            name: "investorCount",
            type: "u32",
          },
          {
            name: "claimCount",
            type: "u32",
          },
          {
            name: "entrepreneurClaimed",
            type: "bool",
          },
          {
            name: "bump",
            type: "u8",
          },
        ],
      },
    },
    {
      name: "investorPosition",
      type: {
        kind: "struct",
        fields: [
          {
            name: "pool",
            type: "pubkey",
          },
          {
            name: "investor",
            type: "pubkey",
          },
          {
            name: "contributed",
            type: "u64",
          },
          {
            name: "claimed",
            type: "bool",
          },
          {
            name: "bump",
            type: "u8",
          },
        ],
      },
    },
    {
      name: "settlementRecord",
      type: {
        kind: "struct",
        fields: [
          {
            name: "pool",
            type: "pubkey",
          },
          {
            name: "entrepreneur",
            type: "pubkey",
          },
          {
            name: "returnedAmount",
            type: "u64",
          },
          {
            name: "approved",
            type: "bool",
          },
          {
            name: "bump",
            type: "u8",
          },
        ],
      },
    },
    {
      name: "poolStatus",
      type: {
        kind: "enum",
        variants: [
          {
            name: "open",
          },
          {
            name: "funded",
          },
          {
            name: "active",
          },
          {
            name: "settlementPending",
          },
          {
            name: "settled",
          },
          {
            name: "cancelled",
          },
        ],
      },
    },
    {
      name: "platformInitialized",
      type: {
        kind: "struct",
        fields: [
          {
            name: "authority",
            type: "pubkey",
            index: false,
          },
          {
            name: "usdcMint",
            type: "pubkey",
            index: false,
          },
        ],
      },
    },
    {
      name: "entrepreneurRegistered",
      type: {
        kind: "struct",
        fields: [
          {
            name: "entrepreneur",
            type: "pubkey",
            index: false,
          },
        ],
      },
    },
    {
      name: "proposalCreated",
      type: {
        kind: "struct",
        fields: [
          {
            name: "proposal",
            type: "pubkey",
            index: false,
          },
          {
            name: "entrepreneur",
            type: "pubkey",
            index: false,
          },
          {
            name: "fundingGoal",
            type: "u64",
            index: false,
          },
          {
            name: "entrepreneurProfitBps",
            type: "u16",
            index: false,
          },
        ],
      },
    },
    {
      name: "proposalApproved",
      type: {
        kind: "struct",
        fields: [
          {
            name: "proposal",
            type: "pubkey",
            index: false,
          },
        ],
      },
    },
    {
      name: "poolCreated",
      type: {
        kind: "struct",
        fields: [
          {
            name: "pool",
            type: "pubkey",
            index: false,
          },
          {
            name: "proposal",
            type: "pubkey",
            index: false,
          },
          {
            name: "entrepreneur",
            type: "pubkey",
            index: false,
          },
          {
            name: "fundingGoal",
            type: "u64",
            index: false,
          },
        ],
      },
    },
    {
      name: "contributionMade",
      type: {
        kind: "struct",
        fields: [
          {
            name: "pool",
            type: "pubkey",
            index: false,
          },
          {
            name: "investor",
            type: "pubkey",
            index: false,
          },
          {
            name: "amount",
            type: "u64",
            index: false,
          },
          {
            name: "investorTotal",
            type: "u64",
            index: false,
          },
          {
            name: "poolTotal",
            type: "u64",
            index: false,
          },
        ],
      },
    },
    {
      name: "poolFunded",
      type: {
        kind: "struct",
        fields: [
          {
            name: "pool",
            type: "pubkey",
            index: false,
          },
        ],
      },
    },
    {
      name: "capitalDisbursed",
      type: {
        kind: "struct",
        fields: [
          {
            name: "pool",
            type: "pubkey",
            index: false,
          },
          {
            name: "entrepreneur",
            type: "pubkey",
            index: false,
          },
          {
            name: "amount",
            type: "u64",
            index: false,
          },
        ],
      },
    },
    {
      name: "settlementSubmitted",
      type: {
        kind: "struct",
        fields: [
          {
            name: "pool",
            type: "pubkey",
            index: false,
          },
          {
            name: "returnedAmount",
            type: "u64",
            index: false,
          },
        ],
      },
    },
    {
      name: "settlementApproved",
      type: {
        kind: "struct",
        fields: [
          {
            name: "pool",
            type: "pubkey",
            index: false,
          },
          {
            name: "returnedAmount",
            type: "u64",
            index: false,
          },
        ],
      },
    },
    {
      name: "investorClaimed",
      type: {
        kind: "struct",
        fields: [
          {
            name: "pool",
            type: "pubkey",
            index: false,
          },
          {
            name: "investor",
            type: "pubkey",
            index: false,
          },
          {
            name: "amount",
            type: "u64",
            index: false,
          },
        ],
      },
    },
    {
      name: "entrepreneurProfitClaimed",
      type: {
        kind: "struct",
        fields: [
          {
            name: "pool",
            type: "pubkey",
            index: false,
          },
          {
            name: "entrepreneur",
            type: "pubkey",
            index: false,
          },
          {
            name: "amount",
            type: "u64",
            index: false,
          },
        ],
      },
    },
    {
      name: "poolCancelled",
      type: {
        kind: "struct",
        fields: [
          {
            name: "pool",
            type: "pubkey",
            index: false,
          },
        ],
      },
    },
    {
      name: "investorRefunded",
      type: {
        kind: "struct",
        fields: [
          {
            name: "pool",
            type: "pubkey",
            index: false,
          },
          {
            name: "investor",
            type: "pubkey",
            index: false,
          },
          {
            name: "amount",
            type: "u64",
            index: false,
          },
        ],
      },
    },
  ],
} as const;
type Mutable<T> = T extends readonly (infer U)[]
  ? number extends T["length"]
    ? Mutable<U>[]
    : { -readonly [K in keyof T]: Mutable<T[K]> }
  : T extends object
    ? { -readonly [K in keyof T]: Mutable<T[K]> }
    : T;
export type Mooncreditfi = Mutable<typeof idl>;
export const IDL: Mooncreditfi = JSON.parse(JSON.stringify(idl));
