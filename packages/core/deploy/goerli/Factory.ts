import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

import { StreamSwapPool__factory } from '../../generated/typechain/factories/StreamSwapPool__factory';
import { wei } from '@synthetixio/wei';
import { ethers } from 'hardhat';
import { cfaDeployAddress, superfluidDeployAddress } from './constants';
import { Superfluid__factory, SuperTokenFactory__factory, SuperToken__factory } from '../../generated/typechain';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const {deploy, execute, save} = hre.deployments;
    const {deployer} = await hre.getNamedAccounts();

    const streamSwapLibraryDeploy = await deploy('StreamSwapLibrary', {
        from: deployer
    });

    const streamSwapFactoryHelperDeploy = await deploy('StreamSwapFactoryHelper', {
        from: deployer,
        libraries: {
            StreamSwapLibrary: streamSwapLibraryDeploy.address
        }
    });

    const ssf = await deploy('StreamSwapFactory', {
        from: deployer,
        args: [ streamSwapFactoryHelperDeploy.address, superfluidDeployAddress, cfaDeployAddress ],
    });

    await execute('StreamSwapFactory', {
        from: deployer
    }, 'newBPool');

    //if(ssf.newlyDeployed) {
        // make super tokens
        
        const fUSDCDeploy = await hre.deployments.get('FakeUSDC');
        const fUNIDeploy = await hre.deployments.get('FakeUNI');
        const fWBTCDeploy = await hre.deployments.get('FakeWBTC');

        const signer = await ethers.getNamedSigner('deployer');

        const superFluid = Superfluid__factory.connect(superfluidDeployAddress, signer);

        await save('SuperTokenFactory', {
            abi: SuperTokenFactory__factory.abi,
            address: await superFluid.getSuperTokenFactory()
        });

        const fUSDCExec = await execute('SuperTokenFactory', {
            from: deployer
        }, 'createERC20Wrapper(address,uint8,string,string)', fUSDCDeploy.address, 0, 'Super Fake USD Coin', 'xfUSDC');
        const fUNIExec = await execute('SuperTokenFactory', {
            from: deployer
        }, 'createERC20Wrapper(address,uint8,string,string)', fUNIDeploy.address, 0, 'Super Fake Uniswap Token', 'xfUNI');
        const fWBTCExec = await execute('SuperTokenFactory', {
            from: deployer
        }, 'createERC20Wrapper(address,uint8,string,string)', fWBTCDeploy.address, 0, 'Super Fake Wrapped BTC', 'xfWBTC');

        const xfUSDCAddress = '0x' + fUSDCExec.events![0].topics[1].slice(26);
        const xfUNIAddress = '0x' + fUNIExec.events![0].topics[1].slice(26);
        const xfWBTCAddress = '0x' + fWBTCExec.events![0].topics[1].slice(26);

        await save('SuperFakeUSDC', {
            abi: SuperToken__factory.abi,
            address: xfUSDCAddress
        });

        await save('SuperFakeUNI', {
            abi: SuperToken__factory.abi,
            address: xfUNIAddress
        });

        await save('SuperFakeWBTC', {
            abi: SuperToken__factory.abi,
            address: xfWBTCAddress
        });

        await execute('FakeUSDC', {
            from: deployer
        }, 'approve', xfUSDCAddress, ethers.constants.MaxInt256);

        await execute('FakeUNI', {
            from: deployer
        }, 'approve', xfUNIAddress, ethers.constants.MaxInt256);

        await execute('FakeWBTC', {
            from: deployer
        }, 'approve', xfWBTCAddress, ethers.constants.MaxInt256);

        await execute('SuperFakeUSDC', {
            from: deployer
        }, 'upgrade', wei(5000).toBN());

        await execute('SuperFakeUNI', {
            from: deployer
        }, 'upgrade', wei(5000).toBN());

        await execute('SuperFakeWBTC', {
            from: deployer
        }, 'upgrade', wei(5000).toBN());
    //}
};

export default func;
func.tags = ['StreamSwapFactory', 'SuperFakeUSDC', 'SuperFakeUNI', 'SuperFakeWBTC'];
func.dependencies = ['FakeUSDC', 'FakeUNI', 'FakeWBTC'];