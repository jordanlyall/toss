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
