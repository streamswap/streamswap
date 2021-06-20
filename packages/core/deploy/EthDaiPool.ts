import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

import { StreamSwapPool__factory } from '../generated/typechain/factories/StreamSwapPool__factory';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const {deploy, execute, save} = hre.deployments;
    const {deployer} = await hre.getNamedAccounts();

    const superfluidDeploy = await hre.deployments.get('Superfluid');
    const cfaDeploy = await hre.deployments.get('ConstantFlowAgreementV1');

    await deploy('StreamSwapFactory', {
        from: deployer,
        gasLimit: 10000000,
        args: [ superfluidDeploy, cfaDeploy ],
    });
    
    const poolDeploy = await execute('StreamSwapFactory', {
        from: deployer
    }, 'newBPool', []);

    save('StreamSwapPool', {
        abi: StreamSwapPool__factory.abi,
        address: poolDeploy.events![0]
    });

    // bind xETH
    await execute('StreamSwapPool', {
        from: deployer
    }, 'bind', []);

    // bind xDAI
    await execute('StreamSwapPool', {
        from: deployer
    }, 'bind', []);
};
export default func;