/* eslint-disable prefer-const */

import {
  AgreementAccountStateUpdated,
  AgreementCreated,
  AgreementLiquidated,
  AgreementStateUpdated,
  AgreementTerminated,
  AgreementUpdated,
  Bailout,
  Burned,
  Minted,
  Sent,
  TokenDowngraded,
  TokenUpgraded,
  Transfer,
} from '../generated/StreamSwap/SuperToken';
import { Address, ethereum } from '@graphprotocol/graph-ts';
import { SuperToken } from '../generated/StreamSwap/SuperToken';
import { Token, User, UserToken } from '../generated/schema';
import { assert, convertTokenToDecimal, getCFAContract } from './helpers';

function update(user: Address, event: ethereum.Event): void {
  let userId = user.toHex();
  let tokenId = event.address.toHex();
  let userTokenId = userId.concat('-').concat(tokenId);
  let userToken = UserToken.load(userTokenId);
  if (!userToken) {
    // This user is not trading this token on streamswap
    return;
  }

  updateUserTokenBalances(userToken!, event);
}

export function updateUserTokenBalances(
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

// export function handleAgreementCreated(event: AgreementCreated): void {}

export function handleAgreementLiquidated(event: AgreementLiquidated): void {
  update(event.params.penaltyAccount, event);
  update(event.params.rewardAccount, event);
}

export function handleAgreementStateUpdated(event: AgreementStateUpdated): void {
  update(event.params.account, event);
}

// export function handleAgreementTerminated(event: AgreementTerminated): void {}
// export function handleAgreementUpdated(event: AgreementUpdated): void {}
// export function handleBailout(event: Bailout): void {}

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
