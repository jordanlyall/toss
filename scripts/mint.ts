import { ethers } from "hardhat";
import deployed from "../lib/deployed.json";

// Mint N demo NFTs from the deployer to the deployer.
// Count from env (MINT_COUNT) or CLI arg, default 1.
async function main() {
  const countArg = process.env.MINT_COUNT || process.argv[2] || "1";
  const count = Number.parseInt(countArg, 10);
  if (!Number.isFinite(count) || count < 1) {
    throw new Error(`Invalid count: ${countArg}`);
  }

  const nftAddr = deployed?.demoNFT;
  if (!nftAddr) {
    throw new Error("DemoNFT not deployed. Run `npm run deploy:sepolia` first.");
  }

  const [deployer] = await ethers.getSigners();
  console.log(`Minting ${count} DemoNFT(s) to ${deployer.address}`);
  console.log(`DemoNFT: ${nftAddr}`);

  const nft = await ethers.getContractAt("DemoNFT", nftAddr, deployer);

  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const tx = await nft.mint();
    const receipt = await tx.wait();
    if (!receipt) throw new Error("No receipt");

    // ERC-721 Transfer(from, to, tokenId) - tokenId is topic[3]
    const transferTopic = ethers.id("Transfer(address,address,uint256)");
    let tokenId: string | null = null;
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== nftAddr.toLowerCase()) continue;
      if (log.topics[0] !== transferTopic) continue;
      if (log.topics.length < 4) continue;
      tokenId = BigInt(log.topics[3]).toString();
      break;
    }
    if (!tokenId) throw new Error("Could not find tokenId in receipt");
    ids.push(tokenId);
    console.log(`  [${i + 1}/${count}] tokenId=${tokenId} tx=${tx.hash}`);
  }

  console.log("\nMinted tokenIds:", ids.join(", "));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
