// mostly a copy of https://github.com/Uniswap/uniswap-v2-subgraph/blob/537e5392719ea9b02b3e56a42c1f3eba116d6918/src/mappings/dayUpdates.ts

import { BigDecimal, BigInt, ethereum } from '@graphprotocol/graph-ts';
import {
  DailyPooledToken,
  HourlyPooledToken,
  Pool,
  PoolDayData,
  PooledToken,
  PoolHourData,
  Token,
  TokenDayData,
} from '../generated/schema';
import { ONE_BI, ZERO_BD, ZERO_BI } from './helpers';

let BI_DAY = BigInt.fromI32(86400);
let BI_HOUR = BigInt.fromI32(3600);

export function updatePoolDayData(event: ethereum.Event, type?: string): PoolDayData {
  let timestamp = event.block.timestamp;
  let dayId = timestamp.div(BI_DAY);
  let dayStartTimestamp = dayId.times(BI_DAY);
  let poolId = event.address.toHex();
  let dayPoolID = `${poolId}-${dayId}`;
  let pool = Pool.load(poolId);
  let poolDayData = PoolDayData.load(dayPoolID);
  if (!poolDayData) {
    poolDayData = new PoolDayData(dayPoolID);
    poolDayData.date = dayStartTimestamp.toI32();
    poolDayData.pool = poolId;
    poolDayData.dailyInstantSwapCount = ZERO_BI;
    poolDayData.dailyContinuousSwapSetCount = ZERO_BI;
    poolDayData.tokens = [];
  }

  let poolTokens = pool.tokens;
  for (let i = 0; i < poolTokens.length; ++i) {
    let tokenId = poolTokens[i];
    let pooledToken = PooledToken.load(`${tokenId}-${poolId}`);
    let dailyPooledTokenId = `${tokenId}-${poolId}-${dayId}`;
    let dailyPooledToken =
      DailyPooledToken.load(dailyPooledTokenId) || new DailyPooledToken(dailyPooledTokenId);
    dailyPooledToken.token = tokenId;
    dailyPooledToken.reserve = pooledToken.reserve;
    dailyPooledToken.dailyVolume = pooledToken.volume;
    dailyPooledToken.save();
    if (!poolDayData.tokens.includes(dailyPooledTokenId)) {
      poolDayData.tokens.push(dailyPooledTokenId);
    }
  }

  if (type == 'continuous') {
    poolDayData.dailyContinuousSwapSetCount = poolDayData.dailyContinuousSwapSetCount.plus(ONE_BI);
  } else if (type == 'instant') {
    poolDayData.dailyInstantSwapCount = poolDayData.dailyInstantSwapCount.plus(ONE_BI);
  }
  poolDayData.save();

  return poolDayData as PoolDayData;
}

export function updatePoolHourData(event: ethereum.Event, type?: string): PoolHourData {
  let timestamp = event.block.timestamp;
  let hourId = timestamp.div(BI_HOUR);
  let hourStartTimestamp = hourId.times(BI_HOUR);
  let poolId = event.address.toHex();
  let hourPoolID = `${poolId}-${hourId}`;
  let pool = Pool.load(poolId);
  let poolHourData = PoolHourData.load(hourPoolID);
  if (!poolHourData) {
    poolHourData = new PoolHourData(hourPoolID);
    poolHourData.date = hourStartTimestamp.toI32();
    poolHourData.pool = poolId;
    poolHourData.hourlyInstantSwapCount = ZERO_BI;
    poolHourData.hourlyContinuousSwapSetCount = ZERO_BI;
    poolHourData.tokens = [];
  }

  let poolTokens = pool.tokens;
  for (let i = 0; i < poolTokens.length; ++i) {
    let tokenId = poolTokens[i];
    let pooledToken = PooledToken.load(`${tokenId}-${poolId}`);
    let dailyPooledTokenId = `${tokenId}-${poolId}-${hourId}`;
    let hourlyPooledToken =
      HourlyPooledToken.load(dailyPooledTokenId) || new HourlyPooledToken(dailyPooledTokenId);
    hourlyPooledToken.token = tokenId;
    hourlyPooledToken.reserve = pooledToken.reserve;
    hourlyPooledToken.hourlyVolume = pooledToken.volume;
    hourlyPooledToken.save();
    if (!poolHourData.tokens.includes(dailyPooledTokenId))
      poolHourData.tokens.push(dailyPooledTokenId);
  }

  if (type == 'continuous') {
    poolHourData.hourlyContinuousSwapSetCount =
      poolHourData.hourlyContinuousSwapSetCount.plus(ONE_BI);
  } else if (type == 'instant') {
    poolHourData.hourlyInstantSwapCount = poolHourData.hourlyInstantSwapCount.plus(ONE_BI);
  }
  poolHourData.save();

  return poolHourData as PoolHourData;
}

export function updateTokenDayData(
  token: Token,
  event: ethereum.Event,
  type?: string,
): TokenDayData {
  let timestamp = event.block.timestamp;
  let dayId = timestamp.div(BI_DAY);
  let dayStartTimestamp = dayId.times(BI_DAY);
  let tokenDayID = `${token.id}-${dayId}`;

  let tokenDayData = TokenDayData.load(tokenDayID);
  if (!tokenDayData) {
    tokenDayData = new TokenDayData(tokenDayID);
    tokenDayData.date = dayStartTimestamp.toI32();
    tokenDayData.token = token.id;
    tokenDayData.dailyVolumeToken = ZERO_BD;
    tokenDayData.dailyInstantSwapCount = ZERO_BI;
    tokenDayData.dailyContinuousSwapSetCount = ZERO_BI;
    tokenDayData.totalLiquidityToken = ZERO_BD;
  }
  tokenDayData.totalLiquidityToken = token.totalLiquidity;
  if (type == 'continuous') {
    tokenDayData.dailyContinuousSwapSetCount =
      tokenDayData.dailyContinuousSwapSetCount.plus(ONE_BI);
  } else if (type == 'instant') {
    tokenDayData.dailyInstantSwapCount = tokenDayData.dailyInstantSwapCount.plus(ONE_BI);
  }
  tokenDayData.save();
  return tokenDayData as TokenDayData;
}
