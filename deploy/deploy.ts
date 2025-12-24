import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedSecretMint = await deploy("SecretMint", {
    from: deployer,
    log: true,
  });

  console.log(`SecretMint contract: `, deployedSecretMint.address);
};
export default func;
func.id = "deploy_secretMint"; // id required to prevent reexecution
func.tags = ["SecretMint"];
