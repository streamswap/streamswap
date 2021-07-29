import 'mocha';

import { deployments, ethers } from 'hardhat';

import { Superfluid } from '../generated/typechain/Superfluid';
import { Superfluid__factory } from '../generated/typechain/factories/Superfluid__factory';
import { <my project>Pool } from '../generated/typechain/<my project>Pool';
import { ethers as Ethers } from 'ethers';
import { <my project>Pool__factory } from '../generated/typechain/factories/<my project>Pool__factory';
import { wei } from '@synthetixio/wei';
import { ConstantFlowAgreementV1, ConstantFlowAgreementV1__factory, SuperToken, SuperToken__factory, TestToken, TestToken__factory } from '../generated/typechain';
import { expect } from 'chai';
import encode<my project>Data from '../utils/encode<my project>Data';

describe('<my project>Pool', function() {

  this.timeout(80000);

  const TESTING_FLOW_RATE = wei(1).div(7).div(86400);

  let signer: Ethers.Signer;

  let myAddress: string = '';

  let tokenA: TestToken|null = null;
  let tokenB: TestToken|null = null;
  let tokenC: TestToken|null = null;

  before(async () => {
    signer = await ethers.getNamedSigner('deployer');
    
    myAddress = await signer.getAddress();

    tokenA = TestToken__factory.connect((await deployments.get('FakeUSDC')).address, signer);
    tokenB = TestToken__factory.connect((await deployments.get('FakeUNI')).address, signer);
    tokenC = TestToken__factory.connect((await deployments.get('FakeWBTC')).address, signer);
  });

  it('should transfer', async () => {
  });
});