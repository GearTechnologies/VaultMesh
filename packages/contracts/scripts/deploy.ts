import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Network:", network.name);

  // 1. Deploy VMeshToken
  const VMeshTokenFactory = await ethers.getContractFactory("VMeshToken");
  const vmeshToken = await VMeshTokenFactory.deploy(deployer.address);
  await vmeshToken.waitForDeployment();
  const vmeshTokenAddress = await vmeshToken.getAddress();
  console.log("VMeshToken deployed to:", vmeshTokenAddress);

  // 2. Deploy RelayRewards (oracle signer = deployer for initial setup)
  const RelayRewardsFactory = await ethers.getContractFactory("RelayRewards");
  const relayRewards = await RelayRewardsFactory.deploy(
    vmeshTokenAddress,
    deployer.address,
    deployer.address
  );
  await relayRewards.waitForDeployment();
  const relayRewardsAddress = await relayRewards.getAddress();
  console.log("RelayRewards deployed to:", relayRewardsAddress);

  // Grant MINTER_ROLE to RelayRewards
  const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
  const grantTx = await vmeshToken.grantRole(MINTER_ROLE, relayRewardsAddress);
  await grantTx.wait();
  console.log("MINTER_ROLE granted to RelayRewards");

  // 3. Deploy ConsentRegistry
  const ConsentRegistryFactory = await ethers.getContractFactory("ConsentRegistry");
  const consentRegistry = await ConsentRegistryFactory.deploy();
  await consentRegistry.waitForDeployment();
  const consentRegistryAddress = await consentRegistry.getAddress();
  console.log("ConsentRegistry deployed to:", consentRegistryAddress);

  // 4. Deploy DeadManSwitch (30 days default, no initial heirs)
  const thirtyDays = 30 * 24 * 60 * 60;
  const DeadManSwitchFactory = await ethers.getContractFactory("DeadManSwitch");
  const deadManSwitch = await DeadManSwitchFactory.deploy(thirtyDays, []);
  await deadManSwitch.waitForDeployment();
  const deadManSwitchAddress = await deadManSwitch.getAddress();
  console.log("DeadManSwitch deployed to:", deadManSwitchAddress);

  // 5. Write deployment addresses
  const deployments = {
    network: network.name,
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    VMeshToken: vmeshTokenAddress,
    RelayRewards: relayRewardsAddress,
    ConsentRegistry: consentRegistryAddress,
    DeadManSwitch: deadManSwitchAddress,
    deployedAt: new Date().toISOString(),
  };

  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  const outPath = path.join(deploymentsDir, `${network.name}.json`);
  fs.writeFileSync(outPath, JSON.stringify(deployments, null, 2));
  console.log(`\nDeployments saved to ${outPath}`);

  if (network.name === "baseSepolia") {
    const baseScanBase = "https://sepolia.basescan.org/address";
    console.log("\n=== BaseScan Links ===");
    console.log(`VMeshToken:       ${baseScanBase}/${vmeshTokenAddress}`);
    console.log(`RelayRewards:     ${baseScanBase}/${relayRewardsAddress}`);
    console.log(`ConsentRegistry:  ${baseScanBase}/${consentRegistryAddress}`);
    console.log(`DeadManSwitch:    ${baseScanBase}/${deadManSwitchAddress}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
