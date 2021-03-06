import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

import { StreamSwapPool__factory } from '../../generated/typechain/factories/StreamSwapPool__factory';
import { wei } from '@synthetixio/wei';
import { ethers } from 'hardhat';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const {deploy, execute, save} = hre.deployments;
    const {deployer} = await hre.getNamedAccounts();

    const superfluidDeploy = await hre.deployments.get('Superfluid');
    const cfaDeploy = await hre.deployments.get('ConstantFlowAgreementV1');

    const streamSwapLibraryDeploy = await deploy('StreamSwapLibrary', {
        from: deployer
    });

    const streamSwapFactoryHelperDeploy = await deploy('StreamSwapFactoryHelper', {
        from: deployer,
        libraries: {
            StreamSwapLibrary: streamSwapLibraryDeploy.address
        }
    });

    await deploy('StreamSwapFactory', {
        from: deployer,
        args: [ streamSwapFactoryHelperDeploy.address, superfluidDeploy.address, cfaDeploy.address ],
    });

    const poolDeploy = await execute('StreamSwapFactory', {
        from: deployer
    }, 'newBPool');

    const poolAddress = '0x' + poolDeploy.events![0].topics[1].slice(26);

    await save('StreamSwapPool', {
        abi: StreamSwapPool__factory.abi,
        address: poolAddress
    });

    const tkaDeploy = await hre.deployments.get('SuperFakeUSDC');
    const tkbDeploy = await hre.deployments.get('SuperFakeUNI');
    const tkcDeploy = await hre.deployments.get('SuperFakeWBTC');

    await execute('FakeUSDC', {
        from: deployer
    }, 'approve', poolAddress, ethers.constants.MaxUint256);

    await execute('FakeUNI', {
        from: deployer
    }, 'approve', poolAddress, ethers.constants.MaxUint256);

    await execute('FakeWBTC', {
        from: deployer
    }, 'approve', poolAddress, ethers.constants.MaxUint256);

    // bind xTKA
    await execute('StreamSwapPool', {
        from: deployer
    }, 'bind', tkaDeploy.address, wei(500).toBN(), wei(2).toBN());

    // bind xTKB
    await execute('StreamSwapPool', {
        from: deployer
    }, 'bind', tkbDeploy.address, wei(500).toBN(), wei(2).toBN());

    // bind xTKB
    await execute('StreamSwapPool', {
        from: deployer
    }, 'bind', tkcDeploy.address, wei(500).toBN(), wei(4).toBN());

    // finalize, which generates new pool tokens
    await execute('StreamSwapPool', {
        from: deployer
    }, 'finalize');
};

export default func;
func.tags = ['StreamSwapFactory', 'StreamSwapPool'];
func.dependencies = ['Superfluid', 'ConstantFlowAgreementV1', 'FakeUSDC', 'FakeUNI', 'FakeWBTC'];