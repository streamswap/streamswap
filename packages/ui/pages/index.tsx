import Link from 'next/link';
import styles from '../styles/Home.module.css';
import MainLayout from '../components/MainLayout';
import Card from '@material-ui/core/Card';
import Grid from '@material-ui/core/Grid';
import CardContent from '@material-ui/core/CardContent';
import T from '@material-ui/core/Typography';
import { useQuery } from '@apollo/client';
import { CLIENT, ContinuousSwap, SWAPS_FROM_ADDRESS } from '../queries/streamswap';

import ContinuousSwapCard from '../components/ContinuousSwapCard';
import { useWeb3React } from '@web3-react/core';
import Wei from '@synthetixio/wei';
import { StreamSwapArgs } from '../utils/encodeStreamSwapData';
import constructFlow from '../utils/flow-constructor';

const Home = () => {

  const { account, active, library } = useWeb3React();

  const existingSwapInfo = useQuery<{ user: { continuousSwaps: ContinuousSwap[] } }>(SWAPS_FROM_ADDRESS, {
    client: CLIENT, skip: !active, variables: {
      address: account?.toLowerCase()
    }
  });

  const continuousSwaps = existingSwapInfo.data?.user.continuousSwaps;

  async function cancelContinuousSwap(cancelledSwap: ContinuousSwap) {

    const matchingSwaps: ContinuousSwap[] = existingSwapInfo.data!.user.continuousSwaps.filter(cs => cs.tokenIn.id == cancelledSwap.tokenIn!.id);

    matchingSwaps.splice(matchingSwaps.findIndex(cs => cs.tokenOut.id == cancelledSwap.tokenOut.id), 1);

    const args: StreamSwapArgs[] = matchingSwaps.map((d) => {
      return {
        destSuperToken: d.tokenOut.id,
        inAmount: new Wei(d.rateIn),
        minOut: new Wei(d.minOut),
        maxOut: new Wei(d.maxOut)
      }
    });

    await constructFlow(library, account!, cancelledSwap.pool.id!, cancelledSwap.tokenIn.id, args);
  }

  return (
    <MainLayout title="Home">
    <T variant="h3" style={{margin: '40px'}}>Balances</T>

    <Grid container spacing={4} justify="center">
    </Grid>
      <T variant="h3" style={{margin: '40px'}}>Open Swaps</T>

      <Grid container spacing={4} justify="center">
        {continuousSwaps?.map(swap => <ContinuousSwapCard continuousSwap={swap} onCancel={cancelContinuousSwap} />)}
      </Grid>
    </MainLayout>
  );
};

export default Home;
