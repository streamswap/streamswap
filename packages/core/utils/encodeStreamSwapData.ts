import Wei, { wei } from "@synthetixio/wei";
import { ethers } from "hardhat";


export interface StreamSwapArgs {
    destSuperToken: string;
    inAmount: Wei;
    minOut: Wei;
    maxOut: Wei;
}

export default function encodeStreamSwapData(args: StreamSwapArgs[]): string {
    const raws = [];

    for (const arg of args) {
        raws.push(ethers.utils.defaultAbiCoder.encode(
            ['address', 'uint', 'uint128', 'uint128'], 
            [arg.destSuperToken, arg.inAmount.toBN(), arg.minOut.toBN(), arg.maxOut.toBN()]
        ));
    }

    return ethers.utils.defaultAbiCoder.encode(['bytes[]'], [ raws ]);
}