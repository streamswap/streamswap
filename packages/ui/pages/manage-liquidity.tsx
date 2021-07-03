import styles from '../styles/form.module.css';
import MainLayout from '../components/MainLayout';

import T from '@material-ui/core/Typography';
import TextField from '@material-ui/core/TextField';
import Grid from '@material-ui/core/Grid';
import Autocomplete, { createFilterOptions } from '@material-ui/lab/Autocomplete';
import Paper from '@material-ui/core/Paper';
import Button from '@material-ui/core/Button';
import RadioGroup from '@material-ui/core/RadioGroup';
import Radio from '@material-ui/core/Radio';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import { Token } from '../queries/streamswap';

const placeholderTokens: Token[] = [
  { symbol: 'USDc', name: 'USDC', decimals: 6, id: '' },
  { symbol: 'WETH', name: 'Wrapped Ether', decimals: 18, id: '' },
];

let mode: 'deposit' | 'withdraw' = 'deposit';

const Save = () => (
  <MainLayout title="Save">
    <Paper className={styles.form}>
      <T variant="h2">Save</T>
      <T variant="body1">Provide liquidity to facilitate the continuous exchange of tokens.</T>

      <Grid container spacing={3}>
        <Grid item sm={3} xs={6}>
          <Autocomplete
            options={placeholderTokens}
            getOptionLabel={(o: Token) => o.symbol}
            filterOptions={createFilterOptions({ stringify: (o) => `${o.symbol} - ${o.name}` })}
            renderInput={(params) => <TextField {...params} label="TokenA" />}
            id="token-a"
            fullWidth
          />
        </Grid>
        <Grid item sm={3} xs={6}>
          <Autocomplete
            options={placeholderTokens}
            getOptionLabel={(o: Token) => o.symbol}
            filterOptions={createFilterOptions({ stringify: (o) => `${o.symbol} - ${o.name}` })}
            renderInput={(params) => <TextField {...params} label="TokenB" />}
            id="token-b"
            fullWidth
          />
        </Grid>
      </Grid>

      {/*TODO: Hide this until a valid pair is selected*/}
      <Paper className={styles.info}>
        <T variant="h6">Pair info</T>
        {/*I assume there is something we want to display here like maybe a graph*/}

        <RadioGroup
          row
          defaultValue="deposit"
          onChange={(_, v: string) => (mode = v as typeof mode)}>
          <FormControlLabel control={<Radio />} label="Deposit" value="deposit" />
          <FormControlLabel control={<Radio />} label="Withdraw" value="withdraw" />
        </RadioGroup>
        <Grid container spacing={3}>
          <Grid item xs={6}>
            <TextField id="token-a" label="TokenA Qty" fullWidth type="number" defaultValue="0" />
          </Grid>
          <Grid item xs={6}>
            <TextField id="token-b" label="TokenB Qty" fullWidth type="number" defaultValue="0" />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Button variant="contained" className={styles.submitButton}>
              Max
            </Button>
          </Grid>
        </Grid>
        <Grid container spacing={3} className={styles.controlRow}>
          <Grid item xs={12} sm={6}>
            <Button className={styles.submitButton}>cancel</Button>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Button color="primary" variant="contained" className={styles.submitButton}>
              {mode}
            </Button>
          </Grid>
        </Grid>
      </Paper>
    </Paper>
  </MainLayout>
);

export default Save;
