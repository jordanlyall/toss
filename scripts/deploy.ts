import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying from:", deployer.address);
  console.log("Balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  const Escrow = await ethers.getContractFactory("ClaimableNFTEscrow");
  const escrow = await Escrow.deploy();
  await escrow.waitForDeployment();
  const escrowAddr = await escrow.getAddress();
  console.log("ClaimableNFTEscrow:", escrowAddr);

  const DemoNFT = await ethers.getContractFactory("DemoNFT");
  const nft = await DemoNFT.deploy("https://toss.app/api/metadata/");
  await nft.waitForDeployment();
  const nftAddr = await nft.getAddress();
  console.log("DemoNFT:", nftAddr);

  // Write addresses to lib/ so the frontend picks them up
  const out = {
    chainId: 84532,
    escrow: escrowAddr,
    demoNFT: nftAddr,
  };
  const outPath = path.join(__dirname, "../lib/deployed.json");
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log("Wrote", outPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
