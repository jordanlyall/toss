// Contract addresses get written here by `npm run deploy:sepolia`.
// Fallback to empty strings so the app compiles pre-deploy.
import deployed from "./deployed.json";

export const CHAIN_ID = 84532; // Base Sepolia

export const ESCROW_ADDRESS = (deployed?.escrow || "") as `0x${string}`;
export const DEMO_NFT_ADDRESS = (deployed?.demoNFT || "") as `0x${string}`;

export const ESCROW_ABI = [
  {
    type: "function",
    name: "deposit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "nftContract", type: "address" },
      { name: "tokenId", type: "uint256" },
      { name: "secretHash", type: "bytes32" },
      { name: "expiresAt", type: "uint64" },
    ],
    outputs: [{ name: "id", type: "uint256" }],
  },
  {
    type: "function",
    name: "claim",
    stateMutability: "nonpayable",
    inputs: [
      { name: "id", type: "uint256" },
      { name: "secret", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "revoke",
    stateMutability: "nonpayable",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "getEscrow",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "sender", type: "address" },
          { name: "nftContract", type: "address" },
          { name: "tokenId", type: "uint256" },
          { name: "secretHash", type: "bytes32" },
          { name: "expiresAt", type: "uint64" },
          { name: "settled", type: "bool" },
        ],
      },
    ],
  },
  {
    type: "event",
    name: "Deposited",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "sender", type: "address", indexed: true },
      { name: "nftContract", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: false },
      { name: "expiresAt", type: "uint64", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Claimed",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "recipient", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "Revoked",
    inputs: [{ name: "id", type: "uint256", indexed: true }],
  },
] as const;

export const DEMO_NFT_ABI = [
  {
    type: "function",
    name: "mint",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [{ name: "id", type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "tokenId", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "setApprovalForAll",
    stateMutability: "nonpayable",
    inputs: [
      { name: "operator", type: "address" },
      { name: "approved", type: "bool" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "isApprovedForAll",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "operator", type: "address" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "tokenURI",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "string" }],
  },
] as const;
