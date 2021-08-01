import Wei from '@synthetixio/wei';
import { ethers } from 'ethers';


export interface StreamSwapArgs {
    destSuperToken: string;
    inAmount: Wei;
    minOut: Wei;
}

export default function encodeStreamSwapData(args: StreamSwapArgs[]): string {
    const raws = [];

    for (const arg of args) {
        raws.push(ethers.utils.defaultAbiCoder.encode(
            ['address', 'uint', 'uint128'], 
            [arg.destSuperToken, arg.inAmount.toBN(), arg.minOut.toBN()]
        ));
    }

    return ethers.utils.defaultAbiCoder.encode(['bytes[]'], [ raws ]);
}