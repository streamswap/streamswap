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

import SuperfluidSDK from '@superfluid-finance/js-sdk';

import { useQuery } from '@apollo/client';

import { TokenDef } from './api/tokens';
import { useState } from 'react';
import { Alert } from '@material-ui/lab';

import { TimePeriod } from '../utils/time';

import { wei } from '@synthetixio/wei';

const Exchange = () => {

  const placeholderTokens: TokenDef[] = [
    { symbol: 'USDc', name: 'USDC', decimals: 6, address: '' },
    { symbol: 'WETH', name: 'Wrapped Ether', decimals: 18, address: '' },
  ];

  const [fromToken, setFromToken] = useState<TokenDef|null>(null);
  const [toToken, setToToken] = useState<TokenDef|null>(null);
  const [inAmount, setInAmount] = useState<number|null>(null);


  const [minOut, setMinOut] = useState<number>(0);
  const [maxOut, setMaxOut] = useState<number>(0);

  const existingSwapInfo = useQuery();
    

  let swapAlert: string|null = null;
  let swapHelpText: string|null = null;

  if(existingSwapInfo.data) {
    swapAlert = `There is an existing continuous swap for this pair of ${}. This will be updated to the new amount if you continue.`
  }

  function executeSwap() {
    const sf = new SuperfluidSDK({
      ethers: null
    });

    await sf.initialize();

    const user = sf.user({
      address: walletAddress[0],
      token: fromToken.address
    });

    await user.flow({
        recipient: '',
        flowRate: wei().toString(0, true)
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
              value={fromToken}
              onChange={(_, newValue) => { setFromToken(newValue) }}
              id="from-token"
              fullWidth
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField required id="from-amount" label="0.0" fullWidth type="number" onChange={(_, value) => setInAmount(value)} />
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
              value={toToken}
              onChange={(_, newValue) => { setToToken(newValue) }}
              id="to-token"
              fullWidth
            />
          </Grid>
        </Grid>

        <FormControlLabel
          control={<Switch checked={state.checkedA} onChange={handleChange} name="checkedA" />}
          label="Secondary"
        />

        <Grid container spacing={3}>
          <Grid item xs={6} sm={4}>
            <TextField
              id="min-received"
              label="Min Received"
              fullWidth
              type="number"
              defaultValue="0"
            />
          </Grid>
          <Grid item xs={6} sm={4}>
            <TextField
              id="max-received"
              label="Max Received"
              fullWidth
              type="number"
              defaultValue="0"
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
