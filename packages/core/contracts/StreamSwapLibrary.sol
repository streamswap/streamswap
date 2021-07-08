// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.7.0;
pragma abicoder v2;

import "hardhat/console.sol";

import {
    ISuperfluid,
    ISuperToken
} from "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperfluid.sol";

import {
    IConstantFlowAgreementV1
} from "@superfluid-finance/ethereum-contracts/contracts/interfaces/agreements/IConstantFlowAgreementV1.sol";

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";

import "@balancer-labs/v2-vault/contracts/interfaces/IVault.sol";

import "./StreamSwapAssetManager.sol";

library StreamSwapLibrary {

    using SafeMath for uint256;

    uint public constant BONE              = 10**18;
    uint public constant EXIT_FEE          = 0;
    uint public constant MIN_BPOW_BASE     = 1 wei;
    uint public constant MAX_BPOW_BASE     = (2 * BONE) - 1 wei;
    uint public constant BPOW_PRECISION    = BONE / 10**10;

    struct Context {
        IVault vault; // balancer vault

        ISuperfluid host; // host
        IConstantFlowAgreementV1 cfa; // the stored constant flow agreement class address
        // output token to input token to receivers
        // only for balancer trade hooks. Limitation for the scalability.

        // use a sparse array to remember changes in the state
        StreamSwapState[] streamSwapState;

        // used for rate updates
        mapping(address => uint64) superTokenToArgs;

        // used for getting existing stream configs for accounts
        mapping(address => mapping (address => uint64)) accountStreamToArgs;

        // used for remembering current balances
        mapping(address => Record) records;

        // used for remembering the asset managers
        StreamSwapAssetManager[] assetManagers;

        mapping(address => bool) managers;

        mapping(address => StreamSwapAssetManager) tokens;
    }

    struct StreamSwapArgs {
        address destSuperToken;
        uint inAmount;
        uint128 minOut;
        uint128 maxOut;
    }

    struct StreamSwapState {
        address srcSuperToken;
        address destSuperToken;
        address sender;
        uint inAmount;
        uint128 minOut;
        uint128 maxOut;

        uint64 prevForSrcSuperToken;
        uint64 nextForDestSuperToken;
        uint64 prevForDestSuperToken;
        uint64 nextForSrcSuperToken;

        uint64 active;
        uint64 nextSenderAccount;
    }

    struct AccountState {
        uint srcBalance;
        uint srcDenom;
        uint destBalance;
        uint destDenom;
    }

    struct Record {
        bool bound;   // is token bound to pool
        uint index;   // private
        uint denorm;  // denormalized weight
        uint balance; // balance (as of last balancer pool operation). this needs to be recorded for remembering relative stream amts
    }

    event LOG_SET_FLOW(
        address indexed caller,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256         minOut,
        uint256         maxOut,
        uint256         tokenRateIn
    );

    event LOG_SET_FLOW_RATE(
        address indexed receiver,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256         tokenRateOut
    );

    function decodeStreamSwapData(bytes memory d) internal pure returns (StreamSwapArgs memory ssa) {
        (
            ssa.destSuperToken,
            ssa.inAmount,
            ssa.minOut,
            ssa.maxOut
        ) = abi.decode(d, (address, uint, uint128, uint128));
    }

    function decodeUserData(bytes memory userData) internal pure returns (StreamSwapArgs[] memory) {

        if (userData.length == 0)
            return new StreamSwapArgs[](0);

        (bytes[] memory arr) = abi.decode(userData, (bytes[]));

        StreamSwapArgs[] memory ssas = new StreamSwapArgs[](arr.length);
        for(uint i = 0;i < arr.length;i++) {
            ssas[i] = decodeStreamSwapData(arr[i]);
        }

        return ssas;
    }

    // link entry 1 to entry 2 sequentially in the list for superToken
    function updateSuperTokenPointers(Context storage ctx, address superToken, uint64 idx1, uint64 idx2) internal {

        if (idx1 == 0) {
            ctx.superTokenToArgs[superToken] = idx2;
            return;
        }

        if (ctx.streamSwapState[idx1].srcSuperToken == superToken) {
            ctx.streamSwapState[idx1].nextForSrcSuperToken = idx2;
        }
        else {
            ctx.streamSwapState[idx1].nextForDestSuperToken = idx2;
        }

        if (ctx.streamSwapState[idx2].srcSuperToken == superToken) {
            ctx.streamSwapState[idx2].prevForSrcSuperToken = idx1;
        }
        else {
            ctx.streamSwapState[idx2].prevForDestSuperToken = idx1;
        }
    }

    function initialize(Context storage ctx) public {
        ctx.streamSwapState.push(StreamSwapState(address(0), address(0), address(0), 0,0,0,0,0,0,0,0,0));
    }

    function updateTrade(Context storage ctx, ISuperToken superToken, bytes memory newSfCtx, 
        StreamSwapState memory args, StreamSwapState storage prevArgs,
        AccountState memory state)
        private
        returns (bytes memory)
    {
        if (prevArgs.destSuperToken == address(0) && args.destSuperToken == address(0)) {
            return newSfCtx;
        }

        console.log("state", state.srcBalance, state.destBalance);
        uint oldOutRate = prevArgs.inAmount > 0 ? getAmountOut(prevArgs.inAmount, state.srcBalance, state.destBalance) : 0;

        uint newOutRate = args.inAmount > 0 ? getAmountOut(args.inAmount, state.srcBalance, state.destBalance) : 0;
        
        // is the trade currently outside its range
        if ((args.minOut != 0 && newOutRate < args.minOut) || (args.maxOut != 0 && newOutRate > args.maxOut)) {
            console.log("out of range", oldOutRate, newOutRate);
            console.log("rates", uint(args.minOut), uint(args.maxOut));
            if (prevArgs.inAmount != args.inAmount || prevArgs.active > 0) {
                console.log("starting inactive");
                if (prevArgs.active > 0) {
                    newSfCtx = ctx.tokens[args.destSuperToken].setFlowWithContext(newSfCtx, args.sender, oldOutRate, 0);
                }

                newSfCtx = ctx.tokens[args.srcSuperToken].setFlowWithContext(newSfCtx, args.sender, prevArgs.active > 0 ? 0 : prevArgs.inAmount, args.inAmount);

                args.active = 0;
            }

            return newSfCtx;
        }
        else if (prevArgs.active == 0) {
            console.log("starting reactivate");
            newSfCtx = ctx.tokens[args.srcSuperToken].setFlowWithContext(newSfCtx, args.sender, prevArgs.inAmount, 0);
            oldOutRate = 0;
            args.active = 1;
        }

        if (prevArgs.destSuperToken != args.destSuperToken) {
            console.log("doing replace");

            newSfCtx = ctx.tokens[prevArgs.destSuperToken].setFlowWithContext(newSfCtx, prevArgs.sender, oldOutRate, 0);
            if(prevArgs.sender != address(0)) {
                emit LOG_SET_FLOW(prevArgs.sender, address(superToken), prevArgs.destSuperToken, 0, 0, 0);
            }

            newSfCtx = ctx.tokens[args.destSuperToken].setFlowWithContext(newSfCtx, args.sender, 0, newOutRate);
            if(args.sender != address(0)) {
                emit LOG_SET_FLOW(args.sender, address(superToken), args.destSuperToken, args.minOut, args.maxOut, args.inAmount);
            }
        }
        else {
            newSfCtx = ctx.tokens[prevArgs.destSuperToken].setFlowWithContext(newSfCtx, prevArgs.sender, oldOutRate, newOutRate);
            emit LOG_SET_FLOW(args.sender, address(superToken), args.destSuperToken, args.minOut, args.maxOut, args.inAmount);
        }

        emit LOG_SET_FLOW_RATE(args.sender, args.srcSuperToken, args.destSuperToken, newOutRate);

        return newSfCtx;
    }

    function addAssetManager(Context storage ctx, StreamSwapAssetManager assetManager) public {
        ctx.assetManagers.push(assetManager);
        ctx.tokens[address(assetManager.superToken)] = assetManager;
        ctx.managers[address(assetManager)] = true;
    }

    function makeTrade(Context storage ctx, ISuperToken superToken, bytes memory newSfCtx)
        public
        returns (bytes memory)
    {
        ISuperfluid.Context memory context = ctx.host.decodeCtx(newSfCtx);
        StreamSwapArgs[] memory args = decodeUserData(context.userData);

        console.log("streamswapargs: decoded", args.length);

        uint inSum = 0;

        uint64[2] memory curStateIdx = [ctx.accountStreamToArgs[context.msgSender][address(superToken)], 0];

        console.log("found existing?", curStateIdx[0] > 0);

        for (uint i = 0;i < args.length;i++) {
            require(args[i].inAmount > 0, "ERR_INVALID_AMOUNT");

            inSum += args[i].inAmount;

            AccountState memory state = AccountState(
                ctx.records[address(superToken)].balance, ctx.records[address(superToken)].denorm, ctx.records[address(args[i].destSuperToken)].balance,
                ctx.records[address(args[i].destSuperToken)].denorm
            );

            console.log("got super balances", state.srcBalance, state.destBalance);

            if (curStateIdx[0] != 0) {
                // update in place
                StreamSwapState storage entry = ctx.streamSwapState[curStateIdx[0]];
                StreamSwapState memory newEntry = StreamSwapState({
                    srcSuperToken: address(superToken),
                    destSuperToken: args[i].destSuperToken,
                    sender: context.msgSender,
                    inAmount: args[i].inAmount,
                    minOut: args[i].minOut,
                    maxOut: args[i].maxOut,

                    prevForSrcSuperToken: 0,
                    nextForSrcSuperToken: 0,
                    prevForDestSuperToken: 0,
                    nextForDestSuperToken: 0,
                    nextSenderAccount: 0,
                    active: entry.active
                });
                newSfCtx = updateTrade(ctx, superToken, newSfCtx, newEntry, entry, state);

                // update dest super token if it has changed
                if (args[i].destSuperToken != entry.destSuperToken) {
                    updateSuperTokenPointers(ctx, entry.destSuperToken, entry.prevForDestSuperToken, entry.nextForDestSuperToken);

                    entry.destSuperToken = args[i].destSuperToken;
                    uint64 prevHead = ctx.superTokenToArgs[args[i].destSuperToken];
                    updateSuperTokenPointers(ctx, args[i].destSuperToken, curStateIdx[0], prevHead);
                    updateSuperTokenPointers(ctx, args[i].destSuperToken, 0, curStateIdx[0]);
                }

                // update args
                entry.inAmount = args[i].inAmount;
                entry.minOut = args[i].minOut;
                entry.maxOut = args[i].maxOut;

                // could be a side effect from the updateTrade function
                entry.active = newEntry.active;

                curStateIdx[1] = curStateIdx[0];
                curStateIdx[0] = entry.nextSenderAccount;
            }
            else {
                // new stream swap

                StreamSwapState memory newEntry = StreamSwapState({
                    srcSuperToken: address(superToken),
                    destSuperToken: args[i].destSuperToken,
                    sender: context.msgSender,
                    inAmount: args[i].inAmount,
                    minOut: args[i].minOut,
                    maxOut: args[i].maxOut,

                    prevForSrcSuperToken: 0,
                    nextForSrcSuperToken: ctx.superTokenToArgs[address(superToken)],
                    prevForDestSuperToken: 0,
                    nextForDestSuperToken: ctx.superTokenToArgs[args[i].destSuperToken],
                    nextSenderAccount: 0,
                    active: 1
                });

                StreamSwapState storage emptyEntry = ctx.streamSwapState[0];

                newSfCtx = updateTrade(ctx, superToken, newSfCtx, newEntry, emptyEntry, state);

                ctx.streamSwapState.push(newEntry);

                uint64 pos = uint64(ctx.streamSwapState.length - 1);

                if (curStateIdx[1] > 0) {
                    ctx.streamSwapState[curStateIdx[1]].nextSenderAccount = pos;
                }
                else {
                    ctx.accountStreamToArgs[context.msgSender][address(superToken)] = pos;
                }

                updateSuperTokenPointers(ctx, address(superToken), pos, newEntry.nextForSrcSuperToken);
                updateSuperTokenPointers(ctx, address(superToken), 0, pos);

                updateSuperTokenPointers(ctx, args[i].destSuperToken, pos, newEntry.nextForDestSuperToken);
                updateSuperTokenPointers(ctx, args[i].destSuperToken, 0, pos);

                curStateIdx[1] = pos;
            }
        }

        console.log("done with existing ids");

        while (curStateIdx[0] != 0) {
            console.log("pop");

            StreamSwapState storage entry = ctx.streamSwapState[curStateIdx[0]];

            AccountState memory state = AccountState(
                ctx.records[address(superToken)].balance, ctx.records[address(superToken)].denorm, 
                ctx.records[address(entry.destSuperToken)].balance, 
                ctx.records[address(entry.destSuperToken)].denorm
            );

            newSfCtx = updateTrade(ctx, superToken, newSfCtx, ctx.streamSwapState[0], entry, state);

            // src super token list
            updateSuperTokenPointers(ctx, address(superToken), entry.prevForSrcSuperToken, entry.nextForSrcSuperToken);
            updateSuperTokenPointers(ctx, entry.destSuperToken, entry.prevForDestSuperToken, entry.nextForDestSuperToken);

            uint64 nextStateIdx = entry.nextSenderAccount;
            ctx.streamSwapState[curStateIdx[0]] = ctx.streamSwapState[0];

            if(curStateIdx[1] > 0) {
                ctx.streamSwapState[curStateIdx[1]].nextSenderAccount = 0;
            }
            else {
                ctx.accountStreamToArgs[context.msgSender][address(superToken)] = 0;
            }

            curStateIdx[0] = nextStateIdx;
        }

        console.log("final check");

        (,int96 inFlow,,) = ctx.cfa.getFlow(superToken, context.msgSender, address(this));
        require(inSum == uint256(inFlow), "ERR_INVALID_SUM");

        return newSfCtx;
    }

    function updateFlowRates(Context storage ctx, address superToken, StreamSwapLibrary.Record memory newRecord)
        public
    {
        uint curIdx = ctx.superTokenToArgs[superToken];

        console.log("update flow rates");

        while (curIdx > 0) {
            console.log("doing one", curIdx);
            StreamSwapState storage entry = ctx.streamSwapState[curIdx];

            // this is basically a shorter version of what happens in the updateTrade above
            // except it just calls raw `callAgreement` and saves gas

            uint oldOutRate;
            uint newOutRate;
            if(superToken == entry.srcSuperToken) {
                oldOutRate = getAmountOut(entry.inAmount, ctx.records[superToken].balance, ctx.records[entry.destSuperToken].balance);
                newOutRate = getAmountOut(entry.inAmount, newRecord.balance, ctx.records[entry.destSuperToken].balance);
                
                curIdx = entry.nextForSrcSuperToken;
            }
            else {
                oldOutRate = getAmountOut(entry.inAmount, ctx.records[entry.srcSuperToken].balance, ctx.records[superToken].balance);
                newOutRate = getAmountOut(entry.inAmount, ctx.records[entry.srcSuperToken].balance, newRecord.balance);
                
                curIdx = entry.nextForDestSuperToken;
            }

            // is the trade currently outside its range
            if ((entry.minOut != 0 && newOutRate < entry.minOut) || (entry.maxOut != 0 && newOutRate > entry.maxOut)) {
            console.log("out of range", oldOutRate, newOutRate);
            console.log("rates", uint(entry.minOut), uint(entry.maxOut));
                if (entry.active > 0) {
                    console.log("starting deactivate");
                    ctx.tokens[entry.destSuperToken].setFlow(entry.sender, oldOutRate, 0);
                    ctx.tokens[entry.srcSuperToken].setFlow(entry.sender, 0, entry.inAmount);

                    entry.active = 0;
                }

                continue;
            }
            else if (entry.active == 0) {
                console.log("starting reactivate");
                ctx.tokens[entry.srcSuperToken].setFlow(entry.sender, entry.inAmount, 0);
                ctx.tokens[entry.destSuperToken].setFlow(entry.sender, 0, newOutRate);
                entry.active = 1;
            }
            else {
                console.log("change out rate", oldOutRate, newOutRate);
                ctx.tokens[entry.destSuperToken].setFlow(entry.sender, oldOutRate, newOutRate);
            }

            ctx.records[superToken] = newRecord;

            emit LOG_SET_FLOW_RATE(entry.sender, entry.srcSuperToken, entry.destSuperToken, newOutRate);
        }

        console.log("finished update");
    }

    function getAmountOut(uint amountIn, uint reserveIn, uint reserveOut) internal pure returns (uint amountOut) {
        require(amountIn > 0, 'INSUFFICIENT_INPUT_AMOUNT');
        require(reserveIn > 0 && reserveOut > 0, 'INSUFFICIENT_LIQUIDITY');
        uint numerator = amountIn.mul(reserveOut);
        uint denominator = reserveIn.add(amountIn);
        amountOut = numerator / denominator;
    }

    function getAmountIn(uint amountOut, uint reserveIn, uint reserveOut) internal pure returns (uint amountIn) {
        require(amountOut > 0, 'INSUFFICIENT_OUTPUT_AMOUNT');
        require(reserveIn > 0 && reserveOut > 0, 'INSUFFICIENT_LIQUIDITY');
        uint numerator = reserveIn.mul(amountOut);
        uint denominator = reserveOut.sub(amountOut);
        amountIn = (numerator / denominator).add(1);
    }
}