/* eslint-disable prefer-const */
import { BigInt, BigDecimal, log, Address } from '@graphprotocol/graph-ts';
import { ConstantFlowAgreementV1 } from '../generated/StreamSwap/ConstantFlowAgreementV1';

export const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000';

export let ZERO_BI = BigInt.fromI32(0);
export let ONE_BI = BigInt.fromI32(1);
export let ZERO_BD = BigDecimal.fromString('0');
export let ONE_BD = BigDecimal.fromString('1');
export let BI_18 = BigInt.fromI32(18);

export function exponentToBigDecimal(decimals: BigInt): BigDecimal {
  let bd = BigDecimal.fromString('1');
  for (let i = ZERO_BI; i.lt(decimals as BigInt); i = i.plus(ONE_BI)) {
    bd = bd.times(BigDecimal.fromString('10'));
  }
  return bd;
}

let CFA_ADDR = Address.fromString('0xEd6BcbF6907D4feEEe8a8875543249bEa9D308E8');
export function getCFAContract(): ConstantFlowAgreementV1 {
  return ConstantFlowAgreementV1.bind(CFA_ADDR);
}

export function bigDecimalExp18(): BigDecimal {
  return BigDecimal.fromString('1000000000000000000');
}

export function convertEthToDecimal(eth: BigInt): BigDecimal {
  return eth.toBigDecimal().div(exponentToBigDecimal(BI_18));
}

export function convertTokenToDecimal(tokenAmount: BigInt, exchangeDecimals: BigInt): BigDecimal {
  if (exchangeDecimals == ZERO_BI) {
    return tokenAmount.toBigDecimal();
  }
  return tokenAmount.toBigDecimal().div(exponentToBigDecimal(exchangeDecimals));
}

export function equalToZero(value: BigDecimal): boolean {
  const formattedVal = parseFloat(value.toString());
  const zero = parseFloat(ZERO_BD.toString());
  if (zero == formattedVal) {
    return true;
  }
  return false;
}

export function isNullEthValue(value: string): boolean {
  return value == '0x0000000000000000000000000000000000000000000000000000000000000001';
}

export function assert(statement: boolean, description: string): void {
  if (!statement) {
    log.critical('Assert failure: {}', [description]);
    throw new Error(description);
  }
}
