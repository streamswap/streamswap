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

import { TokenDef } from './api/tokens';
import { useState } from 'react';
import { Alert } from '@material-ui/lab';

import { TimePeriod } from '../utils/time';

import { wei } from '@synthetixio/wei';
import { useWeb3React } from '@web3-react/core';
import { ContinuousSwap, SWAPS_FROM_ADDRESS_FROM_TOKEN } from '../queries/swaps';

import { encodeStreamSwapData } from '@streamswap/core/utils/encodeStreamSwapData';

const Exchange = () => {

  const { account, chainId, library } = useWeb3React();

  const placeholderTokens: TokenDef[] = [
    { symbol: 'USDC', name: 'USD Coin', decimals: 6, address: '' },
    { symbol: 'WETH', name: 'Wrapped Ether', decimals: 18, address: '' },
  ];

  const [inToken, setInToken] = useState<TokenDef|null>(null);
  const [outToken, setOutToken] = useState<TokenDef|null>(null);
  const [inAmount, setInAmount] = useState<string>('');

  const [advancedEnabled, setAdvancedEnabled] = useState<boolean>(false);

  const [minOut, setMinOut] = useState<string>('');
  const [maxOut, setMaxOut] = useState<string>('');

  const existingSwapInfo = useQuery<ContinuousSwap[]>(SWAPS_FROM_ADDRESS_FROM_TOKEN, { skip: !account || !inToken, variables: { account, fromToken: inToken } });

  let swapAlert: string|null = null;
  let swapHelpText: string|null = null;

  if(existingSwapInfo.data) {
    swapAlert = `There is an existing continuous swap for this pair of ${}. This will be updated to the new amount if you continue.`
  }

  if (!inToken || !outToken || !inAmount) {
    swapHelpText = 'Swap'; // waiting for fields to be filled in
  }
  else if (!account) {
    swapHelpText = 'Select Wallet';
  }
  else if (existingSwapInfo.loading) {
    swapHelpText = 'Loading...';
  }

  function executeSwap() {
    const sf = new SuperfluidSDK({
      ethers: library
    });

    await sf.initialize();

    const user = sf.user({ 
      address: account,
      token: inToken!.address
    });

    const ssd = existingSwapInfo.

    await user.flow({
        recipient: '',
        flowRate: wei(inAmount).toString(0, true),
        userData: encodeStreamSwapData(ssd)
    });
  }

  return (
    <MainLayout title="Exchange">
      <Paper className={styles.form}>
        <T variant="h2">Continuous Swap</T>
        <T variant="body1">Continuously exchange one super token for another. Rate automatically adjust to market over time.</T>
  
        <T variant="h6" className={styles.sectionHeading}>
          From
        </T>
        <Grid container spacing={3}>
          <Grid item xs={6} sm={4}>
            <Autocomplete
              options={placeholderTokens}
              getOptionLabel={(o: TokenDef) => o.symbol}
              filterOptions={createFilterOptions({ stringify: (o) => `${o.symbol} - ${o.name}` })}
              renderInput={(params) => <TextField {...params} label="Token" />}
              value={inToken}
              onChange={(_, newValue) => { setInToken(newValue) }}
              id="from-token"
              fullWidth
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField required id="from-amount" label="0.0" fullWidth type="number" value={inAmount} onChange={(event) => setInAmount(parseFloat(event!.target.value))} />
          </Grid>
          <Grid item xs={6} sm={4}>
            <Select id="from-rate-unit" defaultValue="d" fullWidth className={styles.selectInput}>
              {Object.keys(TimePeriod).map(v => <MenuItem value={v}>/{v}</MenuItem>)}
            </Select>
          </Grid>
        </Grid>
  
        <T variant="h6" className={styles.sectionHeading}>
          To
        </T>
          <Grid container spacing={3}>
          <Grid item xs={6} sm={4}>
            <Autocomplete
              options={placeholderTokens}
              getOptionLabel={(o: TokenDef) => o.symbol}
              filterOptions={createFilterOptions({ stringify: (o) => `${o.symbol} - ${o.name}` })}
              renderInput={(params) => <TextField {...params} label="Token" />}
              value={outToken}
              onChange={(_, newValue) => { setOutToken(newValue) }}
              id="to-token"
              fullWidth
            />
          </Grid>
        </Grid>

        <FormControlLabel
          control={<Switch checked={advancedEnabled} onChange={(_, value) => setAdvancedEnabled(value)} />}
          label="Advanced options"
        />

        <Grid container spacing={3}>
          <Grid item xs={6} sm={4}>
            <TextField
              id="min-received"
              label="Min Received"
              fullWidth
              type="number"
              value={minOut || ''}
              onChange={(event) => { setMinOut(newValue) }}
            />
          </Grid>
          <Grid item xs={6} sm={4}>
            <TextField
              id="max-received"
              label="Max Received"
              fullWidth
              type="number"
              value={maxOut || ''}
              onChange={(event) => { setMaxOut(newValue) }}
            />
          </Grid>
        </Grid>

        {swapAlert && <Alert severity="info">{swapAlert}</Alert>}
  
        <Grid container spacing={3} className={styles.controlRow}>
          <Grid item xs={6}>
            <Button color="primary" variant="contained" className={styles.submitButton} onClick={executeSwap}>
              {swapHelpText || 'Swap'}
            </Button>
          </Grid>
        </Grid>
      </Paper>
    </MainLayout>
  ); 
}

export default Exchange;
