import MainLayout from '../components/MainLayout';
import Grid from '@material-ui/core/Grid';
import T from '@material-ui/core/Typography';
import { useQuery } from '@apollo/client';
import { Balance, CLIENT, ContinuousSwap, SWAPS_FROM_ADDRESS } from '../queries/streamswap';

import BalanceCard from '../components/BalanceCard';
import ContinuousSwapCard from '../components/ContinuousSwapCard';
import { useWeb3React } from '@web3-react/core';
import Wei from '@synthetixio/wei';
import { StreamSwapArgs } from '../utils/encodeStreamSwapData';
import constructFlow from '../utils/flow-constructor';
import { useEffect } from 'react';

const Home = () => {

  const { account, active, library } = useWeb3React();

  const existingSwapInfo = useQuery<{ user: { continuousSwaps: ContinuousSwap[] } }>(SWAPS_FROM_ADDRESS, {
    client: CLIENT, skip: !active, variables: {
      address: account?.toLowerCase()
    }
  });

  useEffect(() => {
    // ensure fresh data
    existingSwapInfo.refetch();
  }, []);

  const continuousSwaps = existingSwapInfo.data?.user?.continuousSwaps;
  const balances: Balance[] = [];

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
      {!active ? <T>Connect a wallet</T> : (<div>
      <T variant="h3" style={{margin: '40px'}}>Balances</T>

      <Grid container spacing={4} justify="center">
        {balances?.map(balance => <BalanceCard key={balance.token.id} balance={balance} />)}
      </Grid>
      <T variant="h3" style={{margin: '40px'}}>Open Swaps</T>

      <Grid container spacing={4} justify="center">
        {continuousSwaps?.map(swap => <ContinuousSwapCard key={swap.tokenIn.id + swap.tokenOut.id} continuousSwap={swap} onCancel={cancelContinuousSwap} />)}
      </Grid>
      </div>)}
      
    </MainLayout>
  );
};

export default Home;
