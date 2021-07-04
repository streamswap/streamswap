/* eslint-disable prefer-const */

import {
  AgreementAccountStateUpdated,
  AgreementLiquidated,
  AgreementStateUpdated,
  Burned,
  Minted,
  Sent,
  SuperToken,
  TokenDowngraded,
  TokenUpgraded,
  Transfer,
} from '../generated/StreamSwap/SuperToken';
import { Address, ethereum } from '@graphprotocol/graph-ts';
import { Token, UserToken } from '../generated/schema';
import { assert, convertTokenToDecimal, getCFAContract } from './helpers';

function update(user: Address, event: ethereum.Event): void {
  let userToken = makeUserToken(user, event.address, event);
  updateUserTokenBalances(userToken, event);
}

export function makeUserToken(
  userAddr: Address,
  tokenAddr: Address,
  event: ethereum.Event,
  token?: Token,
): UserToken {
  let userId = userAddr.toHex();
  let tokenId = tokenAddr.toHex();
  let userTokenId = userId.concat('-').concat(tokenId);
  let userToken = UserToken.load(userTokenId)!;
  if (!userToken) {
    userToken = new UserToken(userTokenId);
    userToken.token = tokenId;
    userToken.user = userId;
    updateUserTokenBalances(userToken, event, token);
  }
  return userToken;
}

function updateUserTokenBalances(
  userToken: UserToken,
  event: ethereum.Event,
  token: Token | null = null,
): void {
  if (!token) token = Token.load(userToken.token)!;
  assert(token != null, 'Token must be defined');
  let tokenAddr = Address.fromString(userToken.token);
  let tokenContract = SuperToken.bind(tokenAddr);
  let cfaContract = getCFAContract();
  let userAddr = Address.fromString(userToken.user);
  userToken.balance = convertTokenToDecimal(tokenContract.balanceOf(userAddr), token.decimals);
  userToken.netFlow = convertTokenToDecimal(
    cfaContract.getNetFlow(tokenAddr, userAddr),
    token.decimals,
  );
  userToken.lastAction = event.block.timestamp;
  userToken.save();
}

export function handleAgreementAccountStateUpdated(event: AgreementAccountStateUpdated): void {
  update(event.params.account, event);
}

export function handleAgreementLiquidated(event: AgreementLiquidated): void {
  update(event.params.penaltyAccount, event);
  update(event.params.rewardAccount, event);
}

export function handleAgreementStateUpdated(event: AgreementStateUpdated): void {
  update(event.params.account, event);
}

export function handleBurned(event: Burned): void {
  update(event.params.from, event);
}

export function handleMinted(event: Minted): void {
  update(event.params.to, event);
}

export function handleSent(event: Sent): void {
  update(event.params.from, event);
  update(event.params.to, event);
}

export function handleTokenDowngraded(event: TokenDowngraded): void {
  update(event.params.account, event);
}

export function handleTokenUpgraded(event: TokenUpgraded): void {
  update(event.params.account, event);
}

export function handleTransfer(event: Transfer): void {
  update(event.params.from, event);
  update(event.params.to, event);
}
