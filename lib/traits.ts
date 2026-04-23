import { keccak256, encodePacked } from "viem";

const PALETTES = [
  "Paper",
  "Sun",
  "Ocean",
  "Forest",
  "Noir",
  "Neon",
] as const;

export type PaletteName = (typeof PALETTES)[number];

// The three ink colors per palette, mirrored from contracts/DemoNFT.sol:_palette.
// Useful when something needs to visually echo the piece (e.g. confetti on
// claim colored in the exact inks the art is drawn with).
export const PALETTE_INKS: Record<PaletteName, [string, string, string]> = {
  Paper: ["#141413", "#d97757", "#6a9bcc"],
  Sun: ["#d35400", "#f39c12", "#16a085"],
  Ocean: ["#0d3b66", "#06a3d9", "#fe5f55"],
  Forest: ["#2e4d3a", "#bf4e30", "#e6b88a"],
  Noir: ["#1a1a1a", "#8b0000", "#2d4a66"],
  Neon: ["#ff2e63", "#08d9d6", "#ffd93d"],
};

export type Traits = {
  palette: PaletteName;
  gridSize: number; // 4-7
  hasOuterRing: boolean;
};

// Mirror of the derivation in contracts/DemoNFT.sol:_render. Pure function of
// tokenId; same inputs yield the same traits. Nothing needs to be fetched.
export function deriveTraits(tokenId: bigint): Traits {
  const h = keccak256(encodePacked(["uint256"], [tokenId]));
  const g = parseInt(h.slice(2, 4), 16);

  let paletteIdx = g & 0x07;
  if (paletteIdx >= 6) paletteIdx = paletteIdx % 6;

  const gridSize = 4 + ((g >> 3) & 0x03);
  const hasOuterRing = (g & 0x80) !== 0;

  return {
    palette: PALETTES[paletteIdx],
    gridSize,
    hasOuterRing,
  };
}
