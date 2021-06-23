import 'mocha';

import { deployments, ethers } from 'hardhat';

import { Superfluid } from '../generated/typechain/Superfluid';
import { Superfluid__factory } from '../generated/typechain/factories/Superfluid__factory';
import { StreamSwapPool } from '../generated/typechain/StreamSwapPool';
import { ethers as Ethers } from 'ethers';
import { StreamSwapPool__factory } from '../generated/typechain/factories/StreamSwapPool__factory';
import { wei } from '@synthetixio/wei';
import { ConstantFlowAgreementV1, ConstantFlowAgreementV1__factory, SuperToken, SuperToken__factory, TestToken, TestToken__factory } from '../generated/typechain';
import { expect } from 'chai';
import encodeStreamSwapData from '../utils/encodeStreamSwapData';

describe('StreamSwapPool', function() {

  const TESTING_FLOW_RATE = wei(1).div(7).div(86400);

  let signer: Ethers.Signer;

  let myAddress: string = '';

  let sf: Superfluid|null = null;
  let cfa: ConstantFlowAgreementV1|null = null;
  let streamSwap: StreamSwapPool|null = null;

  let tokenA: TestToken|null = null;
  let tokenB: TestToken|null = null;
  let tokenC: TestToken|null = null;

  let superTokenA: SuperToken|null = null;
  let superTokenB: SuperToken|null = null;
  let superTokenC: SuperToken|null = null;

  before(async () => {
    signer = await ethers.getNamedSigner('deployer');
    
    myAddress = await signer.getAddress();

    await deployments.fixture();

    const sfDeploy = await deployments.get('Superfluid');
    const streamSwapDeploy = await deployments.get('StreamSwapPool');

    sf = Superfluid__factory.connect(sfDeploy.address, signer);
    cfa = ConstantFlowAgreementV1__factory.connect((await deployments.get('ConstantFlowAgreementV1')).address, signer);
    streamSwap = StreamSwapPool__factory.connect(streamSwapDeploy.address, signer);

    tokenA = TestToken__factory.connect((await deployments.get('TokenA')).address, signer);
    tokenB = TestToken__factory.connect((await deployments.get('TokenB')).address, signer);
    tokenC = TestToken__factory.connect((await deployments.get('TokenC')).address, signer);
    superTokenA = SuperToken__factory.connect((await deployments.get('SuperTokenA')).address, signer);
    superTokenB = SuperToken__factory.connect((await deployments.get('SuperTokenB')).address, signer);
    superTokenC = SuperToken__factory.connect((await deployments.get('SuperTokenC')).address, signer);
  });

  it('should swap single stream', async () => {
    await sf!.callAgreement(cfa!.address, cfa!.interface.encodeFunctionData('createFlow', [
        superTokenA!.address,
        streamSwap!.address,
        TESTING_FLOW_RATE.toBN(),
        "0x"
    ]), 
    encodeStreamSwapData([{
      destSuperToken: superTokenB!.address,
      inAmount: TESTING_FLOW_RATE,
      minRate: wei(0),
      maxRate: wei(100)
    }]));
  });

  it('should swap instant', async () => {

    const preTokenA = wei(await tokenA!.balanceOf(myAddress));
    const preTokenB = wei(await tokenB!.balanceOf(myAddress));

    await streamSwap!.swapExactAmountIn(tokenA!.address, wei(10).toBN(), tokenB!.address, wei(9).toBN(), wei(10).toBN());
    
    expect(preTokenA.sub(10).toString()).to.equal(wei(await tokenA!.balanceOf(myAddress)).toString());

    /*await streamSwap!.swapExactAmountOut(tokenA!.address, wei(10).toBN(), tokenB!.address, wei(9).toBN(), wei(10).toBN());
    
    expect(preTokenA.sub(20).toNumber()).to.be.lt(wei(await tokenA!.balanceOf(myAddress)).toNumber());
    expect(preTokenB.toNumber()).to.be.lt(wei(await tokenB!.balanceOf(myAddress)).toNumber());*/
  });

  it('should change flow rate of single stream trade', async () => {
    await sf!.callAgreement(cfa!.address, cfa!.interface.encodeFunctionData('updateFlow', [
        superTokenA!.address,
        streamSwap!.address,
        TESTING_FLOW_RATE.mul(2).toBN(),
        "0x"
    ]), 
    encodeStreamSwapData([{
      destSuperToken: superTokenB!.address,
      inAmount: TESTING_FLOW_RATE.mul(2),
      minRate: wei(0),
      maxRate: wei(100)
    }]));
  });

  it('should swap single stream into 2 outputs', async () => {
    await sf!.callAgreement(cfa!.address, cfa!.interface.encodeFunctionData('updateFlow', [
        superTokenA!.address,
        streamSwap!.address,
        TESTING_FLOW_RATE.mul(2).toBN(),
        "0x"
    ]), 
    encodeStreamSwapData([{
      destSuperToken: superTokenB!.address,
      inAmount: TESTING_FLOW_RATE,
      minRate: wei(0),
      maxRate: wei(100)
    }, {
      destSuperToken: superTokenC!.address,
      inAmount: TESTING_FLOW_RATE,
      minRate: wei(0),
      maxRate: wei(100)
    }]));

    expect(wei(await cfa!.getNetFlow(superTokenC!.address, myAddress)).toNumber()).to.be.greaterThan(0);
  });

  it('should end all streams cleanly', async () => {
    await sf!.callAgreement(cfa!.address, cfa!.interface.encodeFunctionData('deleteFlow', [
        superTokenA!.address,
        myAddress,
        streamSwap!.address,
        '0x'
    ]), '0x');

    expect(wei(await cfa!.getNetFlow(superTokenA!.address, myAddress)).toNumber()).to.equal(0);
    expect(wei(await cfa!.getNetFlow(superTokenB!.address, myAddress)).toNumber()).to.equal(0);
    expect(wei(await cfa!.getNetFlow(superTokenC!.address, myAddress)).toNumber()).to.equal(0);


  });

  it('should join and exit', async () => {
    const preTokenA = wei(await tokenA!.balanceOf(myAddress));
    const preTokenB = wei(await tokenB!.balanceOf(myAddress));
    const preTokenC = wei(await tokenC!.balanceOf(myAddress));

    await streamSwap!.joinPool(wei(2).toBN(), [wei(20).toBN(), wei(20).toBN(), wei(10).toBN()]);

    // check balances
    expect(wei(await tokenA!.balanceOf(myAddress)).toNumber()).to.be.lt(preTokenA.toNumber());
    expect(wei(await tokenB!.balanceOf(myAddress)).toNumber()).to.be.lt(preTokenB.toNumber());

    expect(wei(await streamSwap!.balanceOf(myAddress)).toNumber()).to.equal(102);

    await streamSwap!.exitPool(wei(2).toBN(), [wei(5).toBN(), wei(5).toBN(), wei(2.5).toBN()]);

    expect(wei(await tokenA!.balanceOf(myAddress)).toNumber()).to.equal(preTokenA.toNumber());
    expect(wei(await tokenB!.balanceOf(myAddress)).toNumber()).to.equal(preTokenB.toNumber());

    expect(wei(await streamSwap!.balanceOf(myAddress)).toNumber()).to.equal(100);
  });

  it('should swap to another account which is already being streamed to', async () => {

  });

  it('should change stream rates when swap occurs', async () => {

  });
});