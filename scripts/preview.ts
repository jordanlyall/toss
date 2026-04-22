import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

// Deploys DemoNFT to the local hardhat network, mints a few tokens,
// and writes each token's SVG to /tmp/toss-preview-<id>.svg.
// Run: npx hardhat run scripts/preview.ts
async function main() {
  const DemoNFT = await ethers.getContractFactory("DemoNFT");
  const nft = await DemoNFT.deploy();
  await nft.waitForDeployment();
  console.log("DemoNFT (local):", await nft.getAddress());

  const outDir = "/tmp/toss-preview";
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const count = 8;
  for (let i = 0; i < count; i++) {
    const tx = await nft.mint();
    await tx.wait();
    const uri = await nft.tokenURI(i);

    // data:application/json;base64,<b64>
    const b64 = uri.split(",")[1];
    const json = Buffer.from(b64, "base64").toString("utf8");
    const meta = JSON.parse(json);

    // meta.image = data:image/svg+xml;base64,<b64>
    const svgB64 = meta.image.split(",")[1];
    const svg = Buffer.from(svgB64, "base64").toString("utf8");

    const filePath = path.join(outDir, `toss-${i}.svg`);
    fs.writeFileSync(filePath, svg);
    console.log(`  tokenId ${i}: ${svg.length} bytes -> ${filePath}`);
  }

  console.log(`\nOpen: open ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
