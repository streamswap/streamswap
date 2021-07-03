import styles from '../styles/MainLayout.module.css';
import Head from 'next/head';
import WalletInfo from '../components/WalletInfo';
import Footer from '../components/Footer';
import { BottomNavigation, BottomNavigationAction, Divider, Grid } from '@material-ui/core';
import { Dashboard as DashboardIcon, Autorenew as AutorenewIcon, Add as AddIcon } from '@material-ui/icons';
import { useRouter } from 'next/router';
import T from '@material-ui/core/Typography';
import { useWeb3React } from '@web3-react/core';

const MainLayout = (args: { children: JSX.Element | JSX.Element[]; title?: string }) => {
  const router = useRouter();

  return (
    <div className={styles.container}>
      <Head>
        <title>Streamswap{args.title ? ` - ${args.title}` : ''}</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Grid container>
        <WalletInfo />
      </Grid>
      <Divider />
      <T className={styles.title} variant="h1">
        Streamswap
      </T>
      <T className={styles.description} variant="subtitle1" component="p">
        Continuous exchange of{' '}
        <a href="https://superfluid.finance" target="_blank" rel="noopener noreferrer">
          Superfliud
        </a>{' '}
        streams
      </T>
      <BottomNavigation
        value={router.asPath}
        onChange={(_, newValue) => {
          console.log('new route', newValue);
          router.push(newValue);
        }}
        showLabels
      >
        <BottomNavigationAction value="/" label="Dashboard" icon={<DashboardIcon />} />
        <BottomNavigationAction value="/swap" label="Swap" icon={<AutorenewIcon />} />
        <BottomNavigationAction value="/manage-liquidity" label="Add/Remove Liquidity" icon={<AddIcon />} />
      </BottomNavigation>
  
      <main className={styles.main}>{args.children}</main>
      {Footer()}
    </div>
  );
}

export default MainLayout;
