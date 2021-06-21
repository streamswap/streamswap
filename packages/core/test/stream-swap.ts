import 'mocha';

import { deployments, ethers } from 'hardhat';

import { Superfluid } from '../generated/typechain/Superfluid';
import { Superfluid__factory } from '../generated/typechain/factories/Superfluid__factory';
import { StreamSwapPool } from '../generated/typechain/StreamSwapPool';
import { ethers as Ethers } from 'ethers';
import { StreamSwapPool__factory } from '../generated/typechain/factories/StreamSwapPool__factory';

describe('StreamSwapPool', function() {

  let signer: Ethers.Signer;

  let sf: Superfluid|null = null;
  let streamSwap: StreamSwapPool|null = null;

  before(async () => {
    signer = await ethers.getNamedSigner('deployer');

    await deployments.fixture();

    const sfDeploy = await deployments.get('Superfluid');
    const streamSwapDeploy = await deployments.get('StreamSwapPool');

    sf = Superfluid__factory.connect(sfDeploy.address, signer);
    streamSwap = StreamSwapPool__factory.connect(streamSwapDeploy.address, signer);
  });

  it('should join', async () => {
    
  });

  it('should swap', async () => {

  });

  it('should exit', async () => {

  });
});