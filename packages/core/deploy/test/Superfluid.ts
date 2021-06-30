import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

import { wei } from '@synthetixio/wei';

import { SuperToken__factory } from '../../generated/typechain/factories/SuperToken__factory';
import { ethers } from 'ethers';
import { DEPLOY_ERC1820_ADDR, DEPLOY_ERC1820_RAW } from '../../utils/erc1820';



const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const {deploy, execute, save} = hre.deployments;
    const {deployer} = await hre.getNamedAccounts();

    // deploy erc1820, a dependency hidden deep
    try {
        const signer = await hre.ethers.getNamedSigner('deployer');
        
        await signer.sendTransaction({ to: DEPLOY_ERC1820_ADDR, value: wei(0.1).toBN()});
        await signer.provider!.sendTransaction(DEPLOY_ERC1820_RAW);
    } catch(err) {
        console.warn('erc1820 failed deploy:', err);
    }

    const sfDeploy = await deploy('Superfluid', {
        from: deployer,
        gasLimit: 10000000,
        args: [true, false],
    });

    await execute('Superfluid', {
        from: deployer,
    }, 'initialize', deployer);

    const sfFactoryHelperDeploy = await deploy('SuperTokenFactoryHelper', {
        from: deployer,
        gasLimit: 10000000,
        args: [],
    });

    const sfFactoryDeploy = await deploy('SuperTokenFactory', {
        from: deployer,
        gasLimit: 10000000,
        args: [sfDeploy.address, sfFactoryHelperDeploy.address],
    });

    await execute('Superfluid', {
        from: deployer
    }, 'updateSuperTokenFactory', sfFactoryDeploy.address);

    const sfGovDeploy = await deploy('SuperfluidOwnableGovernance', {
        from: deployer
    });

    await execute('SuperfluidOwnableGovernance', {
        from: deployer,
        gasLimit: 12000000,
    }, 'setCFAv1LiquidationPeriod', sfDeploy.address!, ethers.constants.AddressZero, 86400);

    await execute('Superfluid', {
        from: deployer
    }, 'replaceGovernance', sfGovDeploy.address);
    
    const cfaDeploy = await deploy('ConstantFlowAgreementV1', {
        from: deployer,
        gasLimit: 10000000,
        args: [],
    });

    await execute('SuperfluidOwnableGovernance', {
        from: deployer,
        gasLimit: 12000000,
    }, 'registerAgreementClass', sfDeploy.address!, cfaDeploy.address);

    const tkaDeploy = await hre.deployments.get('FakeUSDC');
    const tkbDeploy = await hre.deployments.get('FakeUNI');
    const tkcDeploy = await hre.deployments.get('FakeWBTC');

    const xtkaExec = await execute('SuperTokenFactory', {
        from: deployer,
        gasLimit: 12000000,
    }, 'createERC20Wrapper(address,uint8,string,string)', tkaDeploy.address, 0, 'Super Fake USD Coin', 'xfUSDC');

    const xtkbExec = await execute('SuperTokenFactory', {
        from: deployer,
        gasLimit: 12000000,
    }, 'createERC20Wrapper(address,uint8,string,string)', tkbDeploy.address, 0, 'Super Fake UNI Token', 'xfUNI');

    const xtkcExec = await execute('SuperTokenFactory', {
        from: deployer,
        gasLimit: 12000000,
    }, 'createERC20Wrapper(address,uint8,string,string)', tkcDeploy.address, 0, 'Super Fake Wrapped Bitcoin', 'xfBTC');

    const xtkaAddress = '0x' + xtkaExec.events![0].topics[1].slice(26);
    const xtkbAddress = '0x' + xtkbExec.events![0].topics[1].slice(26);
    const xtkcAddress = '0x' + xtkcExec.events![0].topics[1].slice(26);

    await save('SuperFakeUSDC', {
        abi: SuperToken__factory.abi,
        address: xtkaAddress
    });

    await save('SuperFakeUNI', {
        abi: SuperToken__factory.abi,
        address: xtkbAddress
    });

    await save('SuperFakeWBTC', {
        abi: SuperToken__factory.abi,
        address: xtkcAddress
    });

    await execute('FakeUSDC', {
        from: deployer
    }, 'approve', xtkaAddress, ethers.constants.MaxInt256);

    await execute('FakeUNI', {
        from: deployer
    }, 'approve', xtkbAddress, ethers.constants.MaxInt256);

    await execute('FakeWBTC', {
        from: deployer
    }, 'approve', xtkcAddress, ethers.constants.MaxInt256);

    await execute('SuperFakeUSDC', {
        from: deployer
    }, 'upgrade', wei(5000).toBN());

    await execute('SuperFakeUNI', {
        from: deployer
    }, 'upgrade', wei(5000).toBN());

    await execute('SuperFakeWBTC', {
        from: deployer
    }, 'upgrade', wei(5000).toBN());
};

export default func;
func.tags = ['Superfluid', 'SuperTokenFactory', 'SuperTokenFactoryHelper', 'ConstantFlowAgreementV1'];
func.dependencies = ['FakeUSDC', 'FakeUNI', 'FakeWBTC'];