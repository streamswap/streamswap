import { ethers } from 'ethers';

import SuperfluidSDK from '@superfluid-finance/js-sdk';
import encodeStreamSwapData, { StreamSwapArgs } from '../utils/encodeStreamSwapData';
import Wei from '@synthetixio/wei';

export default async function constructFlow(provider: ethers.providers.Provider, account: string, pool: string, sendToken: string, swaps: StreamSwapArgs[]) {

    const sf = new SuperfluidSDK.Framework({
        ethers: provider
    });

    await sf.initialize();

    if (!swaps.length) {
        await sf.cfa.deleteFlow({
            sender: account,
            receiver: pool,
            superToken: sendToken,
        });

        return;
    }

    let sum = new Wei(0);
    for(const arg of swaps) {
         sum = sum.add(arg.inAmount);
    }

    console.log({
        flowRate: sum.toString(0, true),
        sender: account,
        receiver: pool,
        superToken: sendToken,
        userData: encodeStreamSwapData(swaps),
    });

    const netFlow = await sf.cfa.getNetFlow({
        superToken: sendToken,
        account: account
    });

    console.log('got net flow', netFlow);
    console.log('new flow', sum.toString());

    if(netFlow != 0) {
        await sf.cfa.updateFlow({
            flowRate: sum.toString(0, true),
            sender: account,
            receiver: pool,
            superToken: sendToken,
            userData: encodeStreamSwapData(swaps),
        });
    }
    else {
        await sf.cfa.createFlow({
            flowRate: sum.toString(0, true),
            sender: account,
            receiver: pool,
            superToken: sendToken,
            userData: encodeStreamSwapData(swaps),
        });
    }
}