/* eslint-disable prefer-const */

import { Address, BigDecimal, BigInt, ethereum } from '@graphprotocol/graph-ts';
import { LOG_NEW_POOL } from '../generated/StreamSwap/StreamSwapFactory';
import {
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

export function handleNewPool(event: LOG_NEW_POOL): void {
  let factoryId = event.address.toHex();
  let factory = StreamSwapFactory.load(factoryId);
  if (!factory) {
    factory = new StreamSwapFactory(factoryId);
    factory.poolCount = 0;
    factory.txCount = BigInt.fromI32(0);
  }

  let id = event.params.pool.toHex();
  let pool = new Pool(id);
  pool.createdAtTimestamp = event.block.timestamp;
  pool.createdAtBlockNumber = event.block.number;
  pool.txCount = BigInt.fromI32(0);
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
    token.txCount = BigInt.fromI32(0);
    token.totalLiquidity = BigDecimal.fromString('0');
    token.underlyingToken = contract.getUnderlyingToken();
    token.save();
  }

  let poolId = event.address.toHex();

  let pooledTokenId = tokenId + poolId.slice(2);
  let pooledToken = PooledToken.load(pooledTokenId);
  if (!pooledToken) {
    pooledToken = new PooledToken(pooledTokenId);
    pooledToken.pool = poolId;
    pooledToken.token = tokenId;
    pooledToken.reserve = BigDecimal.fromString('0');
    pooledToken.volume = BigDecimal.fromString('0');
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
  let userId = makeUser(event.params.caller);

}

export function handleSetContinuousSwap(event: LOG_SET_FLOW): void {
  makeTxn(event);
  makeUser(event.params.caller);
}

export function handleSetContinuousSwapRate(event: LOG_SET_FLOW_RATE): void {}

export function handleJoinPool(event: LOG_JOIN): void {
  makeUser(event.params.caller);
}

export function handleExitPool(event: LOG_EXIT): void {
  makeUser(event.params.caller);
}
