import fs from 'fs';
import path from 'path';

import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

import { StreamSwapPool__factory } from '../../generated/typechain/factories/StreamSwapPool__factory';
import { wei } from '@synthetixio/wei';
import { ethers } from 'hardhat';
import { SuperToken__factory, TestToken__factory } from '../../generated/typechain';

const FAKE_DAI_ADDR = '0x88271d333C72e51516B67f5567c728E702b3eeE8';
const SUPER_FAKE_DAI_ADDR = '0xF2d68898557cCb2Cf4C10c3Ef2B034b2a69DAD00';

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

    await save('FakeDAI', {
        abi: TestToken__factory.abi,
        address: FAKE_DAI_ADDR
    })

    await save('SuperFakeDAI', {
        abi: SuperToken__factory.abi,
        address: SUPER_FAKE_DAI_ADDR,
    });

    await execute('FakeDAI', {
        from: deployer
    }, 'approve', poolAddress, ethers.constants.MaxUint256);

    await execute('StreamSwapPool', {
        from: deployer
    }, 'bind', SUPER_FAKE_DAI_ADDR, wei(100).toBN(), wei(1).toBN());

    for(const tokenDeployName of ['SuperFakeUNI', 'SuperFakeWBTC']) {
        const tokenDeploy = await hre.deployments.get(tokenDeployName);
        await execute(tokenDeployName.substr(5), {
            from: deployer
        }, 'approve', poolAddress, ethers.constants.MaxUint256);

        await execute('StreamSwapPool', {
            from: deployer
        }, 'bind', tokenDeploy.address, wei(500).toBN(), wei(4).toBN());
    };

    // finalize, which generates new pool tokens
    await execute('StreamSwapPool', {
        from: deployer
    }, 'finalize');

    // add join/exit for subgraph testing purposes convenience
    await execute('StreamSwapPool', {
        from: deployer
    }, 'joinPool', wei(10).toBN(), [wei(100).toBN(), wei(100).toBN(), wei(100).toBN()]);

    await execute('StreamSwapPool', {
        from: deployer
    }, 'exitPool', wei(5).toBN(), [wei(0).toBN(), wei(0).toBN(), wei(0).toBN()]);
};

export default func;
func.tags = ['StreamSwapPool'];
func.dependencies = ['StreamSwapFactory', 'SuperFakeUSDC', 'SuperFakeUNI', 'SuperFakeWBTC'];