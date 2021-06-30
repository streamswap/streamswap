/* eslint-disable prefer-const */

import { Address, BigDecimal, BigInt, Bytes, ethereum } from '@graphprotocol/graph-ts';
import { LOG_NEW_POOL } from '../generated/StreamSwap/StreamSwapFactory';
import {
  ContinuousSwap,
  InstantSwap,
  Pool,
  PooledToken,
  StreamSwapFactory,
  Token,
  Transaction,
  User,
} from '../generated/schema';
import {
  LOG_BIND_NEW,
  LOG_EXIT,
  LOG_JOIN,
  LOG_SET_FLOW,
  LOG_SET_FLOW_RATE,
  LOG_SWAP,
} from '../generated/templates/Pool/StreamSwapPool';
import { SuperToken } from '../generated/StreamSwap/SuperToken';
import { convertTokenToDecimal, ONE_BI, ZERO_BD, ZERO_BI } from './helpers';

export function handleNewPool(event: LOG_NEW_POOL): void {
  let factoryId = event.address.toHex();
  let factory = StreamSwapFactory.load(factoryId);
  if (!factory) {
    factory = new StreamSwapFactory(factoryId);
    factory.poolCount = 0;
  }

  let poolId = event.params.pool.toHex();
  let pool = new Pool(poolId);
  pool.createdAtTimestamp = event.block.timestamp;
  pool.createdAtBlockNumber = event.block.number;
  pool.instantSwapCount = ZERO_BI;
  pool.continuousSwapSetCount = ZERO_BI;
  pool.liquidityProviderCount = BigInt.fromI32(0);
  pool.save();

  factory.poolCount++;
  factory.save();
}

export function handleNewToken(event: LOG_BIND_NEW): void {
  let tokenId = event.params.token.toHex();
  if (!Token.load(tokenId)) {
    let token = new Token(tokenId);
    let contract = SuperToken.bind(event.params.token);
    token.symbol = contract.symbol();
    token.name = contract.name();
    token.decimals = BigInt.fromI32(contract.decimals());
    token.totalSupply = contract.totalSupply();
    token.instantSwapCount = ZERO_BI;
    token.continuousSwapSetCount = ZERO_BI;
    token.totalLiquidity = ZERO_BD;
    token.underlyingToken = contract.getUnderlyingToken();
    token.save();
  }

  let poolId = event.address.toHex();

  let pooledTokenId = `${tokenId}-${poolId}`;
  let pooledToken = PooledToken.load(pooledTokenId);
  if (!pooledToken) {
    pooledToken = new PooledToken(pooledTokenId);
    pooledToken.pool = poolId;
    pooledToken.token = tokenId;
    pooledToken.reserve = ZERO_BD;
    pooledToken.volume = ZERO_BD;
    pooledToken.save();
  }
}

/** Make a transaction (if not already existing) and return the transaction id */
function makeTxn(event: ethereum.Event): string {
  let transactionId = event.transaction.hash.toHex();
  let transaction = Transaction.load(transactionId);
  if (!transaction) {
    transaction = new Transaction(transactionId);
    transaction.blockNumber = event.block.number;
    transaction.timestamp = event.block.timestamp;
    transaction.save();
  }
  return transactionId;
}

/** Make a new user (if not already existing) and return the userId */
function makeUser(userAddr: Address): string {
  let userId = userAddr.toHex();
  let user = User.load(userId);
  if (!user) {
    user = new User(userId);
    user.save();
  }
  return userId;
}

export function handleInstantSwap(event: LOG_SWAP): void {
  let transactionId = makeTxn(event);
  makeUser(event.params.caller);
  let poolId = event.address.toHex();
  let tokenInId = event.params.tokenIn.toHex();
  let tokenOutId = event.params.tokenOut.toHex();
  let tokenIn = Token.load(tokenInId);
  let tokenOut = Token.load(tokenOutId);

  let swapId = `${transactionId}-${event.logIndex}`;
  let swap = new InstantSwap(swapId);
  swap.pool = event.address.toHex();
  swap.user = event.params.caller.toHex();
  swap.transaction = transactionId;
  swap.timestamp = event.block.timestamp;
  swap.tokenIn = tokenInId;
  swap.tokenOut = tokenOutId;
  swap.amountIn = convertTokenToDecimal(event.params.tokenAmountIn, tokenIn.decimals);
  swap.amountOut = convertTokenToDecimal(event.params.tokenAmountOut, tokenOut.decimals);
  swap.save();

  let pooledInToken = PooledToken.load(`${tokenInId}-${poolId}`);
  let pooledOutToken = PooledToken.load(`${tokenOutId}-${poolId}`);
  pooledInToken.volume = pooledInToken.volume.plus(swap.amountIn);
  pooledOutToken.volume = pooledOutToken.volume.plus(swap.amountOut);
  pooledInToken.save();
  pooledOutToken.save();
}

export function handleSetContinuousSwap(event: LOG_SET_FLOW): void {
  makeTxn(event);
  let userId = makeUser(event.params.caller);

  let tokenInId = event.params.tokenIn.toHex();
  let tokenOutId = event.params.tokenOut.toHex();
  let tokenIn = Token.load(tokenInId);
  let tokenOut = Token.load(tokenOutId);

  let poolId = event.address.toHex();
  let pool = Pool.load(poolId);

  let pooledInTokenId = `${tokenInId}-${poolId}`;
  let pooledInToken = PooledToken.load(pooledInTokenId);

  let swapId = Bytes.fromHexString(
    `${userId}${poolId.slice(2)}${tokenInId.slice(2)}${tokenOutId.slice(2)}`,
  ).toBase58();
  let swap = ContinuousSwap.load(swapId);
  if (!swap) {
    swap = new ContinuousSwap(swapId);
    swap.pool = poolId;
    swap.user = userId;
    swap.tokenIn = tokenInId;
    swap.tokenOut = tokenOutId;
    swap.active = true;
    swap.timestamp = event.block.timestamp;
    swap.rateIn = ZERO_BD;
  }

  let prevTimestamp = swap.timestamp;
  let prevInRate = swap.rateIn;
  let dt = event.block.timestamp.minus(prevTimestamp).toBigDecimal();
  let amountInSinceLastSet = prevInRate.times(dt);
  pooledInToken.volume = pooledInToken.volume.plus(amountInSinceLastSet);
  pooledInToken.save();

  swap.timestamp = event.block.timestamp;
  swap.transaction = event.transaction.hash.toHex();
  swap.minOut = convertTokenToDecimal(event.params.minOut, tokenOut.decimals);
  swap.maxOut = convertTokenToDecimal(event.params.maxOut, tokenOut.decimals);
  swap.rateIn = convertTokenToDecimal(event.params.tokenRateIn, tokenIn.decimals);
  swap.save();

  tokenIn.instantSwapCount = tokenIn.instantSwapCount.plus(ONE_BI);
  tokenOut.instantSwapCount = tokenOut.instantSwapCount.plus(ONE_BI);
  pool.instantSwapCount = pool.instantSwapCount.plus(ONE_BI);
  tokenIn.save();
  tokenOut.save();
  pool.save();
}

export function handleSetContinuousSwapRate(event: LOG_SET_FLOW_RATE): void {
  let userId = event.params.receiver.toHex();

  let poolId = event.address.toHex();
  let pool = Pool.load(poolId);

  let tokenInId = event.params.tokenIn.toHex();
  let tokenOutId = event.params.tokenOut.toHex();
  let tokenIn = Token.load(tokenInId);
  let tokenOut = Token.load(tokenOutId);

  let pooledOutTokenId = `${tokenOutId}-${poolId}`;
  let pooledOutToken = PooledToken.load(pooledOutTokenId);

  let swapId = Bytes.fromHexString(
    `${userId}${poolId.slice(2)}${tokenInId.slice(2)}${tokenOutId.slice(2)}`,
  ).toBase58();
  let swap = ContinuousSwap.load(swapId);

  let prevTotal = swap.totalOutUntilLastSwap;
  let prevTimestamp = swap.timestampLastSwap;
  let prevRate = swap.currentRateOut;
  if (event.params.tokenRateOut.equals(ZERO_BI)) {
    swap.active = false;
    swap.currentRateOut = ZERO_BD;
  } else {
    swap.currentRateOut = convertTokenToDecimal(event.params.tokenRateOut, tokenOut.decimals);
  }

  let curTimestamp = event.block.timestamp;
  let dt = curTimestamp.minus(prevTimestamp).toBigDecimal();
  let tradedSincePrevLastSwap = prevRate.times(dt);
  swap.totalOutUntilLastSwap = prevTotal.plus(tradedSincePrevLastSwap);
  pooledOutToken.volume = pooledOutToken.volume.plus(tradedSincePrevLastSwap);
  swap.timestampLastSwap = curTimestamp;
  swap.save();
  pooledOutToken.save();

  tokenIn.continuousSwapSetCount = tokenIn.continuousSwapSetCount.plus(ONE_BI);
  tokenOut.continuousSwapSetCount = tokenOut.continuousSwapSetCount.plus(ONE_BI);
  pool.continuousSwapSetCount = pool.continuousSwapSetCount.plus(ONE_BI);
  tokenIn.save();
  tokenOut.save();
  pool.save();
}

export function handleJoinPool(event: LOG_JOIN): void {
  makeUser(event.params.caller);
  let tokenId = event.params.tokenIn.toHex();
  let poolId = event.address.toHex();
  let pooledTokenId = `${tokenId}-${poolId}`;
  let pooledToken = PooledToken.load(pooledTokenId);
  let tokenIn = Token.load(tokenId);
  let addedTokens = convertTokenToDecimal(event.params.tokenAmountIn, tokenIn.decimals);
  pooledToken.reserve = pooledToken.reserve.plus(addedTokens);
  pooledToken.save();
  tokenIn.totalLiquidity.plus(addedTokens);
  tokenIn.save();
}

export function handleExitPool(event: LOG_EXIT): void {
  makeUser(event.params.caller);
  let tokenId = event.params.tokenOut.toHex();
  let poolId = event.address.toHex();
  let pooledTokenId = `${tokenId}-${poolId}`;
  let pooledToken = PooledToken.load(pooledTokenId);
  let tokenIn = Token.load(tokenId);
  let removedTokens = convertTokenToDecimal(event.params.tokenAmountOut, tokenIn.decimals);
  pooledToken.reserve = pooledToken.reserve.minus(removedTokens);
  pooledToken.save();
  tokenIn.totalLiquidity.minus(removedTokens);
  tokenIn.save();
}
