import MainLayout from '../components/MainLayout';
import Grid from '@material-ui/core/Grid';
import T from '@material-ui/core/Typography';
import { useQuery } from '@apollo/client';
import { Balance, CLIENT, ContinuousSwap, User, USER_INFO } from '../queries/streamswap';

import BalanceCard from '../components/BalanceCard';
import ContinuousSwapCard from '../components/ContinuousSwapCard';
import { useWeb3React } from '@web3-react/core';
import Wei from '@synthetixio/wei';
import { StreamSwapArgs } from '../utils/encodeStreamSwapData';
import constructFlow from '../utils/flow-constructor';
import { useEffect } from 'react';
import Link from 'next/link';

const Home = () => {

  const { account, active, library } = useWeb3React();

  const userInfo = useQuery<{ user: User }>(USER_INFO, {
    client: CLIENT, skip: !active, variables: {
      address: account?.toLowerCase()
    }
  });

  console.log(userInfo.data);
  console.log(userInfo.error);

  useEffect(() => {
    // ensure fresh data
    userInfo.refetch();
  }, []);

  const continuousSwaps = userInfo.data?.user?.continuousSwaps || [];
  const balances: Balance[] = userInfo.data?.user?.balances || [];

  console.log(continuousSwaps);
  console.log(balances);

  async function cancelContinuousSwap(cancelledSwap: ContinuousSwap) {

    const matchingSwaps: ContinuousSwap[] = userInfo.data!.user.continuousSwaps.filter(cs => cs.tokenIn.id == cancelledSwap.tokenIn!.id);

    matchingSwaps.splice(matchingSwaps.findIndex(cs => cs.tokenOut.id == cancelledSwap.tokenOut.id), 1);

    const args: StreamSwapArgs[] = matchingSwaps.map((d) => {
      return {
        destSuperToken: d.tokenOut.id,
        inAmount: new Wei(d.rateIn),
        minOut: new Wei(d.minOut),
        maxOut: new Wei(d.maxOut)
      }
    });

    try {
      await constructFlow(library, account!, cancelledSwap.pool.id!, cancelledSwap.tokenIn.id, args);
    } catch(err) {
      // todo: handle
      console.error('error sending constructed flow', err);
    }

    userInfo.refetch();
  }

  return (
    <MainLayout title="Home">
      {!active ? <T>Connect a wallet</T> : (userInfo.loading ? <T>Loading...</T> : <div>
      <T variant="h3" style={{margin: '40px'}}>Balances</T>

      <Grid container spacing={4} justify="center">
        {balances.length ? 
          balances.map(balance => <BalanceCard key={balance.token.id} balance={balance} />) :
          <T>No supertoken balances found! <a href="https://app.superfluid.finance/">Get test super tokens.</a></T>}
      </Grid>
      <T variant="h3" style={{margin: '40px'}}>Open Swaps</T>

      <Grid container spacing={4} justify="center">
        {continuousSwaps.length ? 
        continuousSwaps.map(swap => <ContinuousSwapCard key={swap.tokenIn.id + swap.tokenOut.id} continuousSwap={swap} onCancel={cancelContinuousSwap} />) :
        <T>None found! <Link href="/swap"><a>Swap now!</a></Link></T>}
      </Grid>
      </div>)}
      
    </MainLayout>
  );
};

export default Home;
