import styles from '../styles/form.module.css';
import MainLayout from '../components/MainLayout';

import T from '@material-ui/core/Typography';
import Select from '@material-ui/core/Select';
import MenuItem from '@material-ui/core/MenuItem';
import TextField from '@material-ui/core/TextField';
import Grid from '@material-ui/core/Grid';
import Autocomplete, { createFilterOptions } from '@material-ui/lab/Autocomplete';
import Paper from '@material-ui/core/Paper';
import Button from '@material-ui/core/Button';
import Switch from '@material-ui/core/Switch';
import FormControlLabel from '@material-ui/core/FormControlLabel';

import SuperfluidSDK from '@superfluid-finance/js-sdk';

import { useQuery } from '@apollo/client';

import React, { useState } from 'react';
import { Alert } from '@material-ui/lab';

import { TimePeriod } from '../utils/time';

import Wei from '@synthetixio/wei';
import { useWeb3React } from '@web3-react/core';
import { SWAPS_FROM_ADDRESS_FROM_TOKEN, ALL_TOKENS, ContinuousSwap, Token, CLIENT } from '../queries/swaps';

import encodeStreamSwapData, { StreamSwapArgs } from '../utils/encodeStreamSwapData';
import { injected } from '../utils/web3-connectors';
import { ethers } from 'ethers';

import sfJson from '@streamswap/core/artifacts/@superfluid-finance/ethereum-contracts/contracts/superfluid/Superfluid.sol/Superfluid.json';
import cfaJson from '@streamswap/core/artifacts/@superfluid-finance/ethereum-contracts/contracts/agreements/ConstantFlowAgreementV1.sol/ConstantFlowAgreementV1.json'

const Exchange = () => {

  const web3react = useWeb3React();

  const tmpTokens: Token[] = [
    { symbol: 'fUSDC', name: 'Fake USD Coin', decimals: 18, id: '0x810d19e9db5982ebfc829849f8b1d0890425753c' },
    { symbol: 'fUNI', name: 'Fake Uniswap Token', decimals: 18, id: '0xe4cc882c78Aa6D39199Cc77EA36c534DF55748B7' },
    { symbol: 'fWBTC', name: 'Fake Wrapped Bitcoin', decimals: 18, id: '0xe0119Ddd78739A275Fe8856d7b5d2373A1d368Ff' },
  ];

  const [inToken, setInToken] = useState<Token|null>(null);
  const [outToken, setOutToken] = useState<Token|null>(null);

  const [inAmount, setInAmount] = useState<string>('');
  const [inAmountPeriod, setInAmountPeriod] = useState<keyof typeof TimePeriod>('week');

  const [advancedEnabled, setAdvancedEnabled] = useState<boolean>(false);

  const [minOut, setMinOut] = useState<string>('');
  const [maxOut, setMaxOut] = useState<string>('');

  const tokensInfo = useQuery<{ tokens: Token[] }>(ALL_TOKENS, { client: CLIENT });

  const existingSwapInfo = useQuery<{ continuousSwaps: ContinuousSwap[] }>(SWAPS_FROM_ADDRESS_FROM_TOKEN, { client: CLIENT, skip: !web3react.active || !inToken, variables: {
    address: web3react.account, tokenIn: inToken?.id
  }});

  const poolAddress = '0x0ddb2adfecd80b76d801a8e80f393c70908bacf4';
  const allTokens = tmpTokens;

  let swapAlert: string|null = null;
  let swapAction: { text: string, action?: () => void };

  const matchingPrevSwap: ContinuousSwap|null = inToken && outToken && existingSwapInfo.data ? 
    existingSwapInfo.data?.continuousSwaps.find(cs => cs.tokenIn.id == inToken!.id && cs.tokenOut.id == outToken!.id) || null : 
    null;

  if(matchingPrevSwap) {
    swapAlert = `There is an existing continuous swap for this pair of ${matchingPrevSwap.rateIn}. This will be updated to the new amount if you continue.`
  }

  async function connectWallet() {
    web3react.activate(injected);
  }

  async function executeSwap() {
    const sf = new SuperfluidSDK.Framework({
      ethers: web3react.library
    });

    await sf.initialize();

    const args: StreamSwapArgs[] = existingSwapInfo.data!.continuousSwaps.map((d) => {

      if (d == matchingPrevSwap) {
        return {
          destSuperToken: outToken!.id,
          inAmount: new Wei(inAmount).div(inAmountPeriod.valueOf()),
          minOut: advancedEnabled ? new Wei(minOut) : new Wei(0),
          maxOut: advancedEnabled ? new Wei(maxOut) : new Wei(0)
        }
      }

      return {
        destSuperToken: d.tokenOut.id,
        inAmount: new Wei(d.rateIn),
        minOut: new Wei(d.minOut),
        maxOut: new Wei(d.maxOut)
      }
    });

    if (!matchingPrevSwap) {
      args.push({
        destSuperToken: outToken!.id,
        inAmount: new Wei(inAmount).div(TimePeriod[inAmountPeriod]),
        minOut: advancedEnabled ? new Wei(minOut || 0) : new Wei(0),
        maxOut: advancedEnabled ? new Wei(maxOut || 0) : new Wei(0)
      })
    }

    let sum = new Wei(0);
    for(const arg of args) {
      sum = sum.add(arg.inAmount);
    }

    console.log({
      flowRate: sum.toString(0, true),
      sender: web3react.account,
      receiver: poolAddress,
      superToken: inToken!.id,
      userData: encodeStreamSwapData(args),
    });

    console.log(web3react.library.provider);
    const sfc = new ethers.Contract('0x22ff293e14F1EC3A09B137e9e06084AFd63adDF9', sfJson.abi, web3react.library.getSigner(web3react.account));
    const cfa = new ethers.Contract('0xEd6BcbF6907D4feEEe8a8875543249bEa9D308E8', cfaJson.abi);


    await sfc!.callAgreement('0xEd6BcbF6907D4feEEe8a8875543249bEa9D308E8', cfa!.interface.encodeFunctionData('createFlow', [
      inToken!.id,
      poolAddress,
      sum.toBN(),
      '0x'
    ]), encodeStreamSwapData(args));

    /*await sf.cfa.createFlow({
      flowRate: sum.toString(0, true),
      sender: web3react.account,
      receiver: poolAddress,
      superToken: inToken!.id,
      userData: encodeStreamSwapData(args),
    });*/

    /*
    const user = sf.user({ 
      address: web3react.account,
      token: inToken!.id
    });

    await user.flow({
        recipient: poolAddress,
        flowRate: sum.toString(0, true),
        userData: encodeStreamSwapData(args)
    });*/

  }

  if (tokensInfo.error || existingSwapInfo.error) {
    swapAction = { text: 'Error' };
    swapAlert = 'Error: ' + (tokensInfo.error || existingSwapInfo.error);
  }
  else if (!inToken || !outToken || !inAmount) {
    swapAction = { text: 'Enter Values' }; // waiting for fields to be filled in
  }
  else if (!web3react.active) {
    swapAction = { text: 'Connect Wallet', action: connectWallet };
  }
  else if (!tokensInfo.data || !existingSwapInfo.data) {
    swapAction = { text: 'Loading...' };
  }
  else if (Object.is(parseFloat(inAmount), NaN)) {
    swapAction = { text: 'Invalid Amount' };
  }
  else if (inToken.id == outToken.id) {
    swapAction = { text: 'In = Out Token' };
  }
  else {
    swapAction = { text: 'Swap', action: executeSwap };
  }

  return (
    <MainLayout title="Exchange">
      <Paper className={styles.form}>
        <T variant="h2">Continuous Swap</T>
        <T variant="body1">Continuously exchange one super token for another. Rate automatically adjust to market over time.</T>
  
        <Grid container justify="center" spacing={3}>
          <Grid item xs={12} sm={6}>
            <Autocomplete
              options={allTokens || []}
              getOptionLabel={(o: Token) => o.symbol}
              getOptionSelected={(o: Token) => o.id == inToken?.id}
              filterOptions={createFilterOptions({ stringify: (o) => `${o.symbol} - ${o.name}` })}
              renderInput={(params) => <TextField {...params} label="From" />}
              value={inToken}
              onChange={(_, newValue) => { setInToken(newValue) }}
              id="from-token"
              fullWidth
            />
          </Grid>
        </Grid>
        <Grid container justify="center" spacing={3}>
          <Grid item xs={8} sm={4}>
            <TextField required id="from-amount" label={(inToken?.symbol || 'Token') + ' rate'} fullWidth type="text" value={inAmount} onChange={(event) => setInAmount(event!.target.value)} />
          </Grid>
          <Grid item xs={4} sm={2}>
            <Select id="from-rate-unit" fullWidth className={styles.selectInput} value={inAmountPeriod} onChange={(event) => setInAmountPeriod(event.target.value as any)}>
              {Object.keys(TimePeriod).map(v => <MenuItem key={v} value={v}>/{v}</MenuItem>)}
            </Select>
          </Grid>
        </Grid>
        <Grid container justify="center" spacing={3}>
          <Grid item xs={12} sm={6}>
            <Autocomplete
              options={allTokens}
              getOptionLabel={(o: Token) => o.symbol}
              getOptionSelected={(o: Token) => o.id == outToken?.id}
              filterOptions={createFilterOptions({ stringify: (o) => `${o.symbol} - ${o.name}` })}
              renderInput={(params) => <TextField {...params} label="To" />}
              value={outToken}
              onChange={(_, newValue) => { setOutToken(newValue) }}
              id="to-token"
              fullWidth
            />
          </Grid>
        </Grid>

        <Grid container justify="center" spacing={3} style={{ marginTop: '10px' }}>
          <FormControlLabel
            control={<Switch checked={advancedEnabled} onChange={(_, value) => setAdvancedEnabled(value)} />}
            label="Advanced options"
          />
        </Grid>

        {advancedEnabled && <Grid container justify="center" spacing={3}>
          <Grid item xs={6} sm={4}>
            <TextField
              id="min-received"
              label="Min Received"
              fullWidth
              type="text"
              value={minOut || ''}
              onChange={(event) => { setMinOut(event.target.value) }}
            />
          </Grid>
          <Grid item xs={6} sm={4}>
            <TextField
              id="max-received"
              label="Max Received"
              fullWidth
              type="text"
              value={maxOut || ''}
              onChange={(event) => { setMaxOut(event.target.value) }}
            />
          </Grid>
        </Grid>}

        {swapAlert && <Alert severity="info">{swapAlert}</Alert>}
  
        <Grid container justify="center" spacing={3} className={styles.controlRow}>
          <Grid item xs={4}>
            <Button color="primary" variant="contained" className={styles.submitButton} onClick={swapAction.action} disabled={!swapAction.action}>
              {swapAction.text}
            </Button>
          </Grid>
        </Grid>
      </Paper>
    </MainLayout>
  ); 
}

export default Exchange;
