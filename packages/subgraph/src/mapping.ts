/* eslint-disable prefer-const */

import { BigDecimal, BigInt } from '@graphprotocol/graph-ts';
import { LOG_NEW_POOL } from '../generated/StreamSwap/StreamSwapFactory';
import { Pool } from '../generated/schema';
import { LOG_EXIT, LOG_JOIN, LOG_SWAP } from "../generated/templates/Pool/StreamSwapPool";

export function handleNewPool(event: LOG_NEW_POOL): void {
  let id = event.params.pool.toBase58();
  let pool = new Pool(id);
  pool.save();
}

export function handleInstantSwap(event: LOG_SWAP): void {

}

export function handleJoinPool(event: LOG_JOIN): void {

}

export function handleExitPool(event: LOG_EXIT): void {

}