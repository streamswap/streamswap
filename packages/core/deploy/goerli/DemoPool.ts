import fs from 'fs';
import path from 'path';

import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

import { StreamSwapPool__factory } from '../../generated/typechain/factories/StreamSwapPool__factory';
import { wei } from '@synthetixio/wei';
import { ethers } from 'hardhat';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const {execute, save} = hre.deployments;
    const {deployer} = await hre.getNamedAccounts();

    const poolDeploy = await execute('StreamSwapFactory', {
        from: deployer
    }, 'newBPool');

    const poolAddress = '0x' + poolDeploy.events![0].topics[1].slice(26);

    await save('StreamSwapPool', {
        abi: StreamSwapPool__factory.abi,
        address: poolAddress,
        solcInput: JSON.stringify(((await hre.artifacts.getBuildInfo('contracts/StreamSwapPool.sol:StreamSwapPool'))?.input, null, '  '))
    });

    for(const tokenDeployName of ['SuperFakeUSDC', 'SuperFakeUNI', 'SuperFakeWBTC']) {
        const tokenDeploy = await hre.deployments.get(tokenDeployName);
        await execute(tokenDeployName.substr(5), {
            from: deployer
        }, 'approve', poolAddress, ethers.constants.MaxUint256);

        await execute('StreamSwapPool', {
            from: deployer
        }, 'bind', tokenDeploy.address, wei(500).toBN(), wei(2).toBN());
    };

    // finalize, which generates new pool tokens
    await execute('StreamSwapPool', {
        from: deployer
    }, 'finalize');
};

export default func;
func.tags = ['StreamSwapPool'];
func.dependencies = ['StreamSwapFactory', 'SuperFakeUSDC', 'SuperFakeUNI', 'SuperFakeWBTC'];