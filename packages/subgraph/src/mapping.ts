/* eslint-disable prefer-const */

import { BigDecimal, BigInt } from '@graphprotocol/graph-ts';
import { LOG_NEW_POOL } from '../generated/StreamSwap/StreamSwapFactory';
import { Pool, StreamSwapFactory, Token } from '../generated/schema';
import {
  LOG_BIND_NEW,
  LOG_EXIT,
  LOG_FLOW,
  LOG_JOIN,
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
  let pool = Pool.load(poolId) || new Pool(poolId);
  if (!pool.tokens.includes(tokenId)) {
    pool.tokens.push(tokenId);
  }
}

export function handleInstantSwap(event: LOG_SWAP): void {}

export function handleContinuousSwap(event: LOG_FLOW): void {}

export function handleJoinPool(event: LOG_JOIN): void {}

export function handleExitPool(event: LOG_EXIT): void {}
