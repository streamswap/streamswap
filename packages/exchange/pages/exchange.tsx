import styles from '../styles/Exchange.module.css';
import MainLayout from '../components/MainLayout';

import T from '@material-ui/core/Typography';
import Select from '@material-ui/core/Select';
import MenuItem from '@material-ui/core/MenuItem';
import TextField from '@material-ui/core/TextField';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Checkbox from '@material-ui/core/Checkbox';
import Grid from '@material-ui/core/Grid';
import Autocomplete, { createFilterOptions } from '@material-ui/lab/Autocomplete';

interface TokenDef {
  readonly symbol: string;
  readonly name?: string;
  readonly decimals: number;
}
const placeholderTokens: TokenDef[] = [
  { symbol: 'USDc', name: 'USDC', decimals: 6 },
  { symbol: 'WETH', name: 'Wrapped Ether', decimals: 18 },
];

const Exchange = () => (
  <MainLayout title="Exchange">
    <T variant="h2">Exchange</T>
    <T variant="body1">Continuously exchange one super token for another</T>

    <form className={styles.exchange}>
      <T variant="h6" className={styles.sectionHeading}>
        From
      </T>
      <Grid container spacing={3}>
        <Grid item xs={12} sm={5}>
          <TextField required id="fromAmount" label="Amount" fullWidth type="number" />
        </Grid>
        <Grid item xs={6} sm={4}>
          <Autocomplete
            options={placeholderTokens}
            getOptionLabel={(o: TokenDef) => o.symbol}
            filterOptions={createFilterOptions({ stringify: (o) => `${o.symbol} - ${o.name}` })}
            renderInput={(params) => <TextField {...params} label="Token" />}
            id="fromToken"
            fullWidth
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <Select id="from-rate-unit" defaultValue="d" fullWidth className={styles.selectInput}>
            <MenuItem value="s">/second</MenuItem>
            <MenuItem value="m">/minute</MenuItem>
            <MenuItem value="h">/hour</MenuItem>
            <MenuItem value="d">/day</MenuItem>
            <MenuItem value="w">/week</MenuItem>
            <MenuItem value="y">/year</MenuItem>
          </Select>
        </Grid>
      </Grid>

      {/*<T variant="h6" className={styles.sectionHeading}>To</T>*/}
      {/*<Grid container sapcing={3}>*/}
      {/*  <Grid item xs={12}>*/}

      {/*  </Grid>*/}
      {/*</Grid>*/}
    </form>
  </MainLayout>
);

export default Exchange;
