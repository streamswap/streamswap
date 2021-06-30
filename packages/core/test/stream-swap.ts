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

  this.timeout(80000);

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

    /*sf = Superfluid__factory.connect('0x22ff293e14F1EC3A09B137e9e06084AFd63adDF9', signer);
    cfa = ConstantFlowAgreementV1__factory.connect('0xEd6BcbF6907D4feEEe8a8875543249bEa9D308E8', signer);
    streamSwap = StreamSwapPool__factory.connect('0x0ddb2adfecd80b76d801a8e80f393c70908bacf4', signer);

    superTokenA = SuperToken__factory.connect('0x810d19e9db5982ebfc829849f8b1d0890425753c', signer);
    superTokenB = SuperToken__factory.connect('0xe4cc882c78Aa6D39199Cc77EA36c534DF55748B7', signer);
    superTokenC = SuperToken__factory.connect('0xe0119Ddd78739A275Fe8856d7b5d2373A1d368Ff', signer);*/

    await deployments.fixture();

    const sfDeploy = await deployments.get('Superfluid');
    const streamSwapDeploy = await deployments.get('StreamSwapPool');

    sf = Superfluid__factory.connect(sfDeploy.address, signer);
    cfa = ConstantFlowAgreementV1__factory.connect((await deployments.get('ConstantFlowAgreementV1')).address, signer);
    streamSwap = StreamSwapPool__factory.connect(streamSwapDeploy.address, signer);

    tokenA = TestToken__factory.connect((await deployments.get('FakeUSDC')).address, signer);
    tokenB = TestToken__factory.connect((await deployments.get('FakeUNI')).address, signer);
    tokenC = TestToken__factory.connect((await deployments.get('FakeWBTC')).address, signer);
    superTokenA = SuperToken__factory.connect((await deployments.get('SuperFakeUSDC')).address, signer);
    superTokenB = SuperToken__factory.connect((await deployments.get('SuperFakeUNI')).address, signer);
    superTokenC = SuperToken__factory.connect((await deployments.get('SuperFakeWBTC')).address, signer);
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
      minOut: wei(0),
      maxOut: wei(0)
    }]));

    expect(wei(await cfa!.getNetFlow(superTokenB!.address, myAddress)).toNumber()).to.be.greaterThan(0);
  });

  it('should swap instant', async () => {

    const preTokenA = wei(await tokenA!.balanceOf(myAddress));
    const preTokenB = wei(await tokenB!.balanceOf(myAddress));

    await streamSwap!.swapExactAmountIn(tokenA!.address, wei(10).toBN(), tokenB!.address, wei(9).toBN(), wei(10).toBN());
    
    expect(preTokenA.sub(10).toString()).to.equal(wei(await tokenA!.balanceOf(myAddress)).toString());

    await streamSwap!.swapExactAmountOut(tokenA!.address, wei(10).toBN(), tokenB!.address, wei(9).toBN(), wei(10).toBN());
    
    expect(preTokenA.sub(20).toNumber()).to.be.lt(wei(await tokenA!.balanceOf(myAddress)).toNumber());
    expect(preTokenB.toNumber()).to.be.lt(wei(await tokenB!.balanceOf(myAddress)).toNumber());
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
      minOut: wei(0),
      maxOut: wei(0)
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
      minOut: wei(0),
      maxOut: wei(0)
    }, {
      destSuperToken: superTokenC!.address,
      inAmount: TESTING_FLOW_RATE,
      minOut: wei(0),
      maxOut: wei(0)
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

    expect(await sf!.isAppJailed(streamSwap!.address)).to.be.false;
  });

  it('should join and exit', async () => {
    const preTokenA = wei(await tokenA!.balanceOf(myAddress));
    const preTokenB = wei(await tokenB!.balanceOf(myAddress));

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

  it('should return stream when outside minOut/maxOut', async () => {
    await sf!.callAgreement(cfa!.address, cfa!.interface.encodeFunctionData('createFlow', [
      superTokenA!.address,
      streamSwap!.address,
      TESTING_FLOW_RATE.toBN(),
      "0x"
    ]), 
    encodeStreamSwapData([{
      destSuperToken: superTokenB!.address,
      inAmount: TESTING_FLOW_RATE,
      minOut: wei(100).mul(TESTING_FLOW_RATE), // theoretical "impossible" rate
      maxOut: wei(150).mul(TESTING_FLOW_RATE)
    }]));

    // no flowing should happen at this point
    expect(wei(await cfa!.getNetFlow(superTokenB!.address, myAddress)).toNumber()).to.equal(0);
    expect(wei(await cfa!.getNetFlow(superTokenA!.address, myAddress)).toNumber()).to.equal(0);

    // update flow rate
    await sf!.callAgreement(cfa!.address, cfa!.interface.encodeFunctionData('updateFlow', [
      superTokenA!.address,
      streamSwap!.address,
      TESTING_FLOW_RATE.div(2).toBN(),
      "0x"
    ]), 
    encodeStreamSwapData([{
      destSuperToken: superTokenB!.address,
      inAmount: TESTING_FLOW_RATE.div(2),
      minOut: wei(100).mul(TESTING_FLOW_RATE), // theoretical "impossible" rate
      maxOut: wei(150).mul(TESTING_FLOW_RATE)
    }]));

    // still no flowing should happen at this point
    expect(wei(await cfa!.getNetFlow(superTokenB!.address, myAddress)).toNumber()).to.equal(0);
    expect(wei(await cfa!.getNetFlow(superTokenA!.address, myAddress)).toNumber()).to.equal(0);
    
    await sf!.callAgreement(cfa!.address, cfa!.interface.encodeFunctionData('deleteFlow', [
      superTokenA!.address,
      myAddress,
      streamSwap!.address,
      '0x'
    ]), '0x');

    // yet still no flowing should happen at this point
    expect(wei(await cfa!.getNetFlow(superTokenB!.address, myAddress)).toNumber()).to.equal(0);
    expect(wei(await cfa!.getNetFlow(superTokenA!.address, myAddress)).toNumber()).to.equal(0);
  });

  it('should turn off and on stream as rate changes depending on minOut/maxOut', async () => {
    // we will set stream rates based on current rate, which makes it easy to test in/out
    const curRate = await streamSwap!.getSpotPriceSansFee(tokenA!.address, tokenB!.address);

    await sf!.callAgreement(cfa!.address, cfa!.interface.encodeFunctionData('createFlow', [
      superTokenA!.address,
      streamSwap!.address,
      TESTING_FLOW_RATE.toBN(),
      "0x"
    ]), 
    encodeStreamSwapData([{
      destSuperToken: superTokenB!.address,
      inAmount: TESTING_FLOW_RATE,
      minOut: TESTING_FLOW_RATE.div(curRate).mul(1.05),
      maxOut: wei(0)
    }]));

    console.log("the rate is ", TESTING_FLOW_RATE.div(curRate).toString(0, true));

    expect(wei(await cfa!.getNetFlow(superTokenA!.address, myAddress)).toNumber()).to.equal(0);
    expect(wei(await cfa!.getNetFlow(superTokenB!.address, myAddress)).toNumber()).to.equal(0);

    await streamSwap!.swapExactAmountIn(tokenB!.address, wei(50).toBN(), tokenA!.address, wei(30).toBN(), wei(100).toBN());

    expect(wei(await cfa!.getNetFlow(superTokenA!.address, myAddress)).toNumber()).to.be.lessThan(0);
    expect(wei(await cfa!.getNetFlow(superTokenB!.address, myAddress)).toNumber()).to.be.greaterThan(0);

    await streamSwap!.swapExactAmountIn(tokenA!.address, wei(50).toBN(), tokenB!.address, wei(30).toBN(), wei(100).toBN());

    expect(wei(await cfa!.getNetFlow(superTokenA!.address, myAddress)).toNumber()).to.equal(0);
    expect(wei(await cfa!.getNetFlow(superTokenB!.address, myAddress)).toNumber()).to.equal(0);

    await sf!.callAgreement(cfa!.address, cfa!.interface.encodeFunctionData('deleteFlow', [
      superTokenA!.address,
      myAddress,
      streamSwap!.address,
      '0x'
    ]), '0x');

    // yet still no flowing should happen at this point
    expect(wei(await cfa!.getNetFlow(superTokenB!.address, myAddress)).toNumber()).to.equal(0);
    expect(wei(await cfa!.getNetFlow(superTokenA!.address, myAddress)).toNumber()).to.equal(0);
  });
});