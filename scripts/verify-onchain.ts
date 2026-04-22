import { ethers } from "hardhat";
import deployed from "../lib/deployed.json";
import fs from "fs";
import path from "path";

// Reads tokenURI from the deployed DemoNFT on Base Sepolia and writes the SVG.
async function main() {
  const nftAddr = deployed.demoNFT;
  console.log("Reading from:", nftAddr);

  const nft = await ethers.getContractAt("DemoNFT", nftAddr);
  const uri: string = await nft.tokenURI(0);

  const jsonB64 = uri.split(",")[1];
  const json = Buffer.from(jsonB64, "base64").toString("utf8");
  const meta = JSON.parse(json);
  console.log("name:", meta.name);

  const svgB64 = meta.image.split(",")[1];
  const svg = Buffer.from(svgB64, "base64").toString("utf8");
  console.log("svg bytes:", svg.length);

  const outPath = "/tmp/toss-preview/onchain-0.svg";
  fs.writeFileSync(outPath, svg);
  console.log("Wrote", outPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
