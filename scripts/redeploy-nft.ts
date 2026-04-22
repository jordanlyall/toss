import { ethers } from "hardhat";
import fs from "fs";
import path from "path";
import existing from "../lib/deployed.json";

// Redeploys ONLY the DemoNFT contract. Keeps the existing escrow address.
// Use after changing DemoNFT.sol. Run:
//   npx hardhat run scripts/redeploy-nft.ts --network baseSepolia
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying from:", deployer.address);
  console.log("Balance:", (await ethers.provider.getBalance(deployer.address)).toString());
  console.log("Preserving escrow at:", existing.escrow);

  const DemoNFT = await ethers.getContractFactory("DemoNFT");
  const nft = await DemoNFT.deploy();
  await nft.waitForDeployment();
  const nftAddr = await nft.getAddress();
  console.log("DemoNFT (new):", nftAddr);

  const out = {
    chainId: existing.chainId,
    escrow: existing.escrow,
    demoNFT: nftAddr,
  };
  const outPath = path.join(__dirname, "../lib/deployed.json");
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log("Wrote", outPath);

  console.log("\nNext steps:");
  console.log("  1. Update CDP allowlist: replace old DemoNFT with", nftAddr);
  console.log("  2. Redeploy Vercel (or push) so frontend picks up new address");
  console.log("  3. Mint a few to verify: npm run mint:sepolia -- 3");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
