import { Button, Grid } from '@material-ui/core';
import { useWeb3React } from '@web3-react/core';
import { useEffect } from 'react';
import styles from '../styles/WalletInfo.module.css';
import { injected, walletconnect } from '../utils/web3-connectors';

const WalletInfo = () => {
  const { account, active, activate } = useWeb3React();

  useEffect(() => {
    // try to connect to browser wallet by default
    activate(injected);
  }, []);

  return (
    <div className={styles.walletInfo}>
      {active && 
        <Grid container justify="center">
          <Grid container xs={6} justify="center">
            {account}
          </Grid>
        </Grid>
      }
      {!active && 
        <Grid container justify="center">
          <p>Goerli Only.</p>
          <Button variant="contained" onClick={() => { activate(injected) }} style={{margin: '10px'}}>Connect Browser</Button>
          <Button variant="contained" onClick={() => { activate(walletconnect) }} style={{margin: '10px'}}>Connect WalletConnect</Button>
        </Grid>
      }
    </div>
  );
} 

export default WalletInfo;
