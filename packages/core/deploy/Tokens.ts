import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

import { wei } from '@synthetixio/wei';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const {deploy} = hre.deployments;
    const {deployer} = await hre.getNamedAccounts();

    await deploy('TokenA', {
        from: deployer,
        gasLimit: 10000000,
        contract: 'TestToken',
        args: ['Token A', 'TKA', wei(10000).toBN()],
    });

    await deploy('TokenB', {
        from: deployer,
        gasLimit: 10000000,
        contract: 'TestToken',
        args: ['Token B', 'TKB', wei(10000).toBN()],
    });

    await deploy('TokenC', {
        from: deployer,
        gasLimit: 10000000,
        contract: 'TestToken',
        args: ['Token C', 'TKC', wei(10000).toBN()],
    });
};

export default func;
func.tags = ['TokenA', 'TokenB'];