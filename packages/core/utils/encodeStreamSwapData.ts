import Wei, { wei } from "@synthetixio/wei";
import { ethers } from "hardhat";


export interface StreamSwapArgs {
    destSuperToken: string;
    recipient: string;
    inAmount: Wei;
    minRate: Wei;
    maxRate: Wei;
}

export default function encodeStreamSwapData(args: StreamSwapArgs[]): string {
    const raws = [];

    for (const arg of args) {
        raws.push(ethers.utils.defaultAbiCoder.encode(
            ['address', 'uint', 'uint128', 'uint128'], 
            [arg.destSuperToken, arg.recipient, arg.inAmount.toBN(), arg.minRate.toBN(), arg.maxRate.toBN()]
        ));
    }

    return ethers.utils.defaultAbiCoder.encode(['bytes[]'], [ raws ]);
}