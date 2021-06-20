import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const {deploy, execute} = hre.deployments;
    const {deployer} = await hre.getNamedAccounts();

    await deploy('Superfluid', {
        from: deployer,
        gasLimit: 10000000,
        args: [true, false],
    });

    await execute('Superfluid', {
        from: deployer
    }, 'initialize', [ deployer ]);
    
    const cfaDeploy = await deploy('ConstantFlowAgreementV1', {
        from: deployer,
        gasLimit: 10000000,
        args: [],
    });

    await execute('Superfluid', {
        from: deployer
    }, 'registerAgreementClass', [ cfaDeploy.address ]);
};
export default func;