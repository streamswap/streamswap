import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

import { wei } from '@synthetixio/wei';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const {deploy} = hre.deployments;
    const {deployer} = await hre.getNamedAccounts();

    await deploy('FakeWETH', {
        from: deployer,
        contract: 'WETH',
        args: []
    });

    await deploy('FakeUSDC', {
        from: deployer,
        contract: 'TestToken',
        args: ['Fake USD Coin', 'fUSDC', wei(10000).toBN()],
    });

    await deploy('FakeUNI', {
        from: deployer,
        contract: 'TestToken',
        args: ['Fake Uniswap Token', 'fUNI', wei(10000).toBN()],
    });

    await deploy('FakeWBTC', {
        from: deployer,
        contract: 'TestToken',
        args: ['Fake Wrapped BTC', 'fWBTC', wei(10000).toBN()],
    });
};

export default func;
func.tags = ['FakeWETH', 'FakeUSDC', 'FakeUNI', 'FakeWBTC'];