// mostly a copy of https://github.com/Uniswap/uniswap-v2-subgraph/blob/537e5392719ea9b02b3e56a42c1f3eba116d6918/src/mappings/dayUpdates.ts

import { BigDecimal, BigInt, ethereum } from '@graphprotocol/graph-ts';
import {
  DailyPooledToken,
  Pool,
  PoolDayData,
  PooledToken,
  PoolHourData,
  Token,
  TokenDayData,
} from '../generated/schema';
import { ONE_BI, ZERO_BD, ZERO_BI } from './helpers';

let BI_DAY = BigInt.fromI32(86400);

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
    poolDayData.poolAddress = event.address;
    poolDayData.dailyInstantSwapCount = ZERO_BI;
    poolDayData.dailyContinuousSwapSetCount = ZERO_BI;
  }

  pool.tokens.forEach((tokenId) => {
    let pooledToken = PooledToken.load(`${tokenId}-${poolId}`);
    let dailyPooledTokenId = `${tokenId}-${poolId}-${dayId}`;
    let dailyPooledToken =
      DailyPooledToken.load(dailyPooledTokenId) || new DailyPooledToken(dailyPooledTokenId);
    dailyPooledToken.reserve = pooledToken.reserve;
    dailyPooledToken.dailyVolume = pooledToken.volume;
    dailyPooledToken.save();
  });

  if (type == 'continuous') {
    poolDayData.dailyContinuousSwapSetCount = poolDayData.dailyContinuousSwapSetCount.plus(ONE_BI);
  } else if (type == 'instant') {
    poolDayData.dailyInstantSwapCount = poolDayData.dailyInstantSwapCount.plus(ONE_BI);
  }
  poolDayData.save();

  return poolDayData as PoolDayData;
}

// export function updatePoolHourData(event: ethereum.Event): PoolHourData {
//   let timestamp = event.block.timestamp.toI32();
//   let hourIndex = timestamp / 3600; // get unique hour within unix history
//   let hourStartUnix = hourIndex * 3600; // want the rounded effect
//   let hourPairID = event.address
//     .toHexString()
//     .concat('-')
//     .concat(BigInt.fromI32(hourIndex).toString());
//   let pair = Pool.load(event.address.toHexString());
//   let poolHourData = PoolHourData.load(hourPairID);
//   if (poolHourData === null) {
//     poolHourData = new PoolHourData(hourPairID);
//     poolHourData.hourStartUnix = hourStartUnix;
//     poolHourData.pair = event.address.toHexString();
//     poolHourData.hourlyVolumeToken0 = ZERO_BD;
//     poolHourData.hourlyVolumeToken1 = ZERO_BD;
//     poolHourData.hourlyVolumeUSD = ZERO_BD;
//     poolHourData.hourlyTxns = ZERO_BI;
//   }
//
//   poolHourData.reserve0 = pair.reserve0;
//   poolHourData.reserve1 = pair.reserve1;
//   poolHourData.reserveUSD = pair.reserveUSD;
//   poolHourData.hourlyTxns = poolHourData.hourlyTxns.plus(ONE_BI);
//   poolHourData.save();
//
//   return poolHourData as PoolHourData;
// }
//
// export function updateTokenDayData(token: Token, event: ethereum.Event): TokenDayData {
//   let bundle = Bundle.load('1');
//   let timestamp = event.block.timestamp.toI32();
//   let dayID = timestamp / 86400;
//   let dayStartTimestamp = dayID * 86400;
//   let tokenDayID = token.id.toString().concat('-').concat(BigInt.fromI32(dayID).toString());
//
//   let tokenDayData = TokenDayData.load(tokenDayID);
//   if (tokenDayData === null) {
//     tokenDayData = new TokenDayData(tokenDayID);
//     tokenDayData.date = dayStartTimestamp;
//     tokenDayData.token = token.id;
//     tokenDayData.priceUSD = token.derivedETH.times(bundle.ethPrice);
//     tokenDayData.dailyVolumeToken = ZERO_BD;
//     tokenDayData.dailyVolumeETH = ZERO_BD;
//     tokenDayData.dailyVolumeUSD = ZERO_BD;
//     tokenDayData.dailyTxns = ZERO_BI;
//     tokenDayData.totalLiquidityUSD = ZERO_BD;
//   }
//   tokenDayData.priceUSD = token.derivedETH.times(bundle.ethPrice);
//   tokenDayData.totalLiquidityToken = token.totalLiquidity;
//   tokenDayData.totalLiquidityETH = token.totalLiquidity.times(token.derivedETH as BigDecimal);
//   tokenDayData.totalLiquidityUSD = tokenDayData.totalLiquidityETH.times(bundle.ethPrice);
//   tokenDayData.dailyTxns = tokenDayData.dailyTxns.plus(ONE_BI);
//   tokenDayData.save();
//
//   /**
//    * @todo test if this speeds up sync
//    */
//   // updateStoredTokens(tokenDayData as TokenDayData, dayID)
//   // updateStoredPairs(tokenDayData as TokenDayData, dayPairID)
//
//   return tokenDayData as TokenDayData;
// }
