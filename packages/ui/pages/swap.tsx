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

import { useQuery } from '@apollo/client';

import React, { ReactElement, useEffect, useState } from 'react';
import { Alert } from '@material-ui/lab';

import { currentBalance, TimePeriod } from '../utils/time';

import Wei from '@synthetixio/wei';
import { useWeb3React } from '@web3-react/core';
import { USER_INFO, ALL_TOKENS, ALL_POOLS, ContinuousSwap, Token, CLIENT, Pool, User, Balance } from '../queries/streamswap';

import { injected } from '../utils/web3-connectors';
import { StreamSwapArgs } from '../utils/encodeStreamSwapData';
import constructFlow from '../utils/flow-constructor';
import { useRouter } from 'next/router';
import ContinuousSwapCard from '../components/ContinuousSwapCard';

const Swap = () => {

  const router = useRouter();

  const web3react = useWeb3React();

  const [inToken, setInToken] = useState<Token | null>(null);
  const [outToken, setOutToken] = useState<Token | null>(null);

  const [inAmount, setInAmount] = useState<string>('');
  const [inAmountPeriod, setInAmountPeriod] = useState<keyof typeof TimePeriod>('week');

  const [advancedEnabled, setAdvancedEnabled] = useState<boolean>(false);

  const [minOut, setMinOut] = useState<string>('');
  const [maxOut, setMaxOut] = useState<string>('');

  const [txnError, setTxnError] = useState<string>('');

  const tokensInfo = useQuery<{ tokens: Token[] }>(ALL_TOKENS, { client: CLIENT });

  const allTokens = tokensInfo.data ? tokensInfo.data.tokens : null;

  const poolsInfo = useQuery<{ pools: Pool[] }>(ALL_POOLS, { client: CLIENT });

  const userInfo = useQuery<{ user: User }>(USER_INFO, {
    client: CLIENT, skip: !web3react.active, variables: {
      address: web3react.account?.toLowerCase()
    }
  });

  useEffect(() => {
    if(router.query.inToken) {
      setInToken(allTokens!.find(t => t.id == router.query.inToken) || null);
    }
    if(router.query.outToken) {
      setOutToken(allTokens!.find(t => t.id == router.query.outToken) || null);
    }
  }, [tokensInfo.data]);

  const poolAddress = poolsInfo.data ? poolsInfo.data.pools[0].id : null;

  const inTokenBalance: Balance|null = userInfo.data && inToken ? 
    userInfo.data?.user?.balances?.find(b => b.token.symbol == inToken?.symbol) || 
    {balance: '0', netFlow: '0', lastAction: 0} as Balance : null;
  const outTokenBalance: Balance|null = userInfo.data && outToken ? 
    userInfo.data?.user?.balances?.find(b => b.token.symbol == outToken?.symbol) || 
    {balance: '0', netFlow: '0', lastAction: 0} as Balance : null;

  let swapAlert: ReactElement|ReactElement[]|null = null;
  let swapAction: { text: string, action?: () => void };

  const matchingPrevSwaps: ContinuousSwap[] = inToken && outToken && userInfo.data ?
    userInfo.data?.user?.continuousSwaps.filter(cs => cs.tokenIn.id == inToken!.id) || [] :
    [];

  const matchingOut = matchingPrevSwaps.find(cs => cs.tokenOut.id == outToken!.id);

  if (matchingOut) {
    swapAlert = [
      <Alert key="alert" severity="info" style={{marginTop: '20px'}}>There is an existing continuous swap for this pair. This will be updated with new settings if you continue.</Alert>,
      <ContinuousSwapCard key="swapcard" continuousSwap={matchingOut} showActions={false}></ContinuousSwapCard>
    ]
  }

  async function connectWallet() {
    web3react.activate(injected);
  }

  async function executeSwap() {
    const args: StreamSwapArgs[] = matchingPrevSwaps.map((d) => {
      if (d.tokenOut.id == outToken?.id) {
        return {
          destSuperToken: outToken!.id,
          inAmount: new Wei(inAmount).div(TimePeriod[inAmountPeriod]),
          minOut: advancedEnabled ? new Wei(minOut || 0).div(TimePeriod[inAmountPeriod]) : new Wei(0),
          maxOut: advancedEnabled ? new Wei(maxOut || 0).div(TimePeriod[inAmountPeriod]) : new Wei(0)
        }
      }

      return {
        destSuperToken: d.tokenOut.id,
        inAmount: new Wei(d.rateIn),
        minOut: new Wei(d.minOut),
        maxOut: new Wei(d.maxOut)
      }
    });

    if (!matchingOut) {
      args.push({
        destSuperToken: outToken!.id,
        inAmount: new Wei(inAmount).div(TimePeriod[inAmountPeriod]),
        minOut: advancedEnabled ? new Wei(minOut || 0).div(TimePeriod[inAmountPeriod]) : new Wei(0),
        maxOut: advancedEnabled ? new Wei(maxOut || 0).div(TimePeriod[inAmountPeriod]) : new Wei(0)
      });
    }

    try {
      await constructFlow(web3react.library, web3react.account!, poolAddress!, inToken!.id, args);
    } catch(err) {
      return setTxnError('Failed to generate transaction: ' + (err.error ? err.error.message : err.toString()));
    }

    // refetch all data
    userInfo.refetch();
    
    setTxnError('');
  }

  if (tokensInfo.error || poolsInfo.error || userInfo.error) {
    swapAction = { text: 'Error' };
    swapAlert = <Alert severity="error" style={{marginTop: '20px'}}>(tokensInfo.error || poolsInfo.error || existingSwapInfo.error)</Alert>;
  }
  else if (!inToken || !outToken || !inAmount) {
    swapAction = { text: 'Enter Values' }; // waiting for fields to be filled in
  }
  else if (!web3react.active) {
    swapAction = { text: 'Connect Wallet', action: connectWallet };
  }
  else if (!tokensInfo.data || !userInfo.data) {
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

  if(txnError) {
    swapAlert = <Alert severity="error" style={{marginTop: '20px'}}>{txnError}</Alert>;
  }

  return (
    <MainLayout title="Swap">
      <Paper className={styles.form}>
        <T variant="h2">Continuous Swap</T>
        <T variant="body1">Continuously exchange one super token for another. The returned token rate automatically adjusts to market over time.</T>

        <Grid container justify="center" spacing={3}>
          <Grid item xs={12} sm={3}>
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
          <Grid container alignItems="center" xs={12} sm={3}>
            {inTokenBalance != null && <T variant="body1">Balance: {currentBalance(inTokenBalance, new Date()).toString(6)}</T>}
          </Grid>
        </Grid>
        <Grid container justify="center" spacing={3}>
          <Grid item xs={8} sm={3}>
            <TextField required id="from-amount" label={(inToken?.symbol || 'Token') + ' rate'} fullWidth type="text" value={inAmount} onChange={(event) => setInAmount(event!.target.value)} />
          </Grid>
          <Grid item xs={4} sm={3}>
            <Select id="from-rate-unit" fullWidth className={styles.selectInput} value={inAmountPeriod} onChange={(event) => setInAmountPeriod(event.target.value as any)}>
              {Object.keys(TimePeriod).map(v => <MenuItem key={v} value={v}>/{v}</MenuItem>)}
            </Select>
          </Grid>
        </Grid>
        <Grid container justify="center" spacing={3}>
          <Grid item xs={12} sm={3}>
            <Autocomplete
              options={allTokens || []}
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
          <Grid container alignItems="center" xs={12} sm={3}>
            {outTokenBalance != null && <T variant="body1">Balance: {currentBalance(outTokenBalance, new Date()).toString(6)}</T>}
          </Grid>
        </Grid>

        <Grid container justify="center" spacing={3} style={{ marginTop: '10px' }}>
          <FormControlLabel
            control={<Switch checked={advancedEnabled} onChange={(_, value) => setAdvancedEnabled(value)} />}
            label="Advanced options"
          />
        </Grid>

        {advancedEnabled && <Grid container justify="center" spacing={3}>
          <Grid item xs={4} sm={2}>
            <TextField
              id="min-received"
              label="Min Out"
              fullWidth
              type="text"
              value={minOut || ''}
              onChange={(event) => { setMinOut(event.target.value) }}
            />
          </Grid>
          <Grid item xs={4} sm={2}>
            <TextField
              id="max-received"
              label="Max Out"
              fullWidth
              type="text"
              value={maxOut || ''}
              onChange={(event) => { setMaxOut(event.target.value) }}
            />
          </Grid>
          <Grid container alignItems="center" xs={4} sm={2}>/{inAmountPeriod}
          </Grid>
        </Grid>}

        <Grid container justify="center" alignItems="center" direction="column">
          {swapAlert}
        </Grid>

        <Grid container justify="center" spacing={3} className={styles.controlRow}>
          <Grid item sm={4}>
            <Button color="primary" variant="contained" className={styles.submitButton} onClick={swapAction.action} disabled={!swapAction.action}>
              {swapAction.text}
            </Button>
          </Grid>
        </Grid>
      </Paper>
    </MainLayout>
  );
}

export default Swap;
