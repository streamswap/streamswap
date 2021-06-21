// SPDX-License-Identifier: GPLv3
pragma solidity 0.7.6;
pragma abicoder v2;

import {
    ISuperfluid,
    ISuperToken
} from "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperfluid.sol";
//"@superfluid-finance/ethereum-monorepo/packages/ethereum-contracts/contracts/interfaces/superfluid/ISuperfluid.sol";

import {
    IConstantFlowAgreementV1
} from "@superfluid-finance/ethereum-contracts/contracts/interfaces/agreements/IConstantFlowAgreementV1.sol";

import "./balancer/BToken.sol";

library StreamSwapLibrary {
    uint public constant BONE              = 10**18;
    uint public constant EXIT_FEE          = 0;
    uint public constant MIN_BPOW_BASE     = 1 wei;
    uint public constant MAX_BPOW_BASE     = (2 * BONE) - 1 wei;
    uint public constant BPOW_PRECISION    = BONE / 10**10;

    struct Context {
        ISuperfluid host; // host
        IConstantFlowAgreementV1 cfa; // the stored constant flow agreement class address
        // output token to input token to receivers
        // only for balancer trade hooks. Limitation for the scalability.

        mapping(ISuperToken => StreamSwapArgs[]) accountsPayable;
        mapping(address => mapping (ISuperToken => uint[])) accountSwapIndexes;
    }

    struct StreamSwapArgs {
        address destSuperToken;
        address recipient;
        uint inAmount;
        uint minRate;
        uint maxRate;
    }

    struct AccountState {
        uint srcBalance;
        uint destBalance;
        uint srcDenom;
        uint destDenom;
    }

    struct Record {
        bool bound;   // is token bound to pool
        uint index;   // private
        uint denorm;  // denormalized weight
    }

    function decodeStreamSwapData(bytes memory d) internal pure returns (StreamSwapArgs memory ssa) {
        (
            ssa.destSuperToken,
            ssa.recipient,
            ssa.inAmount,
            ssa.minRate,
            ssa.maxRate
        ) = abi.decode(d, (address, address, uint, uint, uint));
    }

    function decodeUserData(bytes memory userData) internal pure returns (StreamSwapArgs[] memory) {
        (bytes[] memory arr) = abi.decode(userData, (bytes[]));

        StreamSwapArgs[] memory ssas = new StreamSwapArgs[](arr.length);
        for(uint i = 0;i < arr.length;i++) {
            ssas[i] = decodeStreamSwapData(arr[i]);
        }

        return ssas;
    }

    function updateTrade(Context storage ctx, ISuperToken superToken, bytes memory newSfCtx, 
        StreamSwapArgs memory args, StreamSwapArgs memory prevArgs,
        AccountState memory curAccountState, AccountState memory prevAccountState)
        public
        returns (bytes memory)
    {
        if (prevArgs.destSuperToken == address(0) && args.destSuperToken == address(0)) {
            return newSfCtx;
        }

        uint oldOutRate = prevArgs.inAmount > 0 ? calcOutGivenIn(
            prevAccountState.srcBalance, prevAccountState.srcDenom, 
            prevAccountState.destBalance, prevAccountState.destBalance, 
            prevArgs.inAmount, 0) : 0;

        uint newOutRate = calcOutGivenIn(
            curAccountState.srcBalance, curAccountState.srcDenom, 
            curAccountState.destBalance, curAccountState.destBalance, 
            args.inAmount, 0);

        (,int96 curOutFlow,,) = ctx.cfa.getFlow(ISuperToken(args.destSuperToken), address(this), args.recipient);

        if (prevArgs.recipient != args.recipient || prevArgs.destSuperToken != args.destSuperToken) {

            if (prevArgs.destSuperToken != address(0) && uint256(curOutFlow) == oldOutRate) {
                (newSfCtx, ) = ctx.host.callAgreementWithContext(
                    ctx.cfa,
                    abi.encodeWithSelector(
                        ctx.cfa.deleteFlow.selector,
                        args.destSuperToken,
                        address(this),
                        args.recipient,
                        new bytes(0) // placeholder
                    ),
                    "0x",
                    newSfCtx
                );
            }
            else if (prevArgs.destSuperToken != address(0) && uint256(curOutFlow) > prevArgs.inAmount) {
                (newSfCtx, ) = ctx.host.callAgreementWithContext(
                    ctx.cfa,
                    abi.encodeWithSelector(
                        ctx.cfa.updateFlow.selector,
                        args.destSuperToken,
                        address(this),
                        args.recipient,
                        uint256(curOutFlow) - oldOutRate,
                        new bytes(0) // placeholder
                    ),
                    "0x",
                    newSfCtx
                );
            }

            if (args.destSuperToken != address(0)) {
                (newSfCtx, ) = ctx.host.callAgreementWithContext(
                    ctx.cfa,
                    abi.encodeWithSelector(
                        curOutFlow == 0 ? ctx.cfa.createFlow.selector : ctx.cfa.updateFlow.selector,
                        args.destSuperToken,
                        address(this),
                        args.recipient,
                        uint256(curOutFlow) + newOutRate,
                        new bytes(0) // placeholder
                    ),
                    "0x",
                    newSfCtx
                );
            }
        }
        else if (oldOutRate != newOutRate) {

            // just modifying amount
            (newSfCtx, ) = ctx.host.callAgreementWithContext(
                ctx.cfa,
                abi.encodeWithSelector(
                    ctx.cfa.updateFlow.selector,
                    args.destSuperToken,
                    address(this),
                    args.recipient,
                    uint256(curOutFlow) + newOutRate - oldOutRate,
                    new bytes(0) // placeholder
                ),
                "0x",
                newSfCtx
            );
        }

        return newSfCtx;
    }

    function makeTrade(Context storage ctx, ISuperToken superToken, bytes memory newSfCtx, mapping(address => StreamSwapLibrary.Record) storage records)
        public
        returns (bytes memory)
    {
        StreamSwapArgs memory EMPTY_ARGS = StreamSwapArgs(address(0), address(0), 0, 0, 0);

        ISuperfluid.Context memory context = ctx.host.decodeCtx(newSfCtx);
        StreamSwapArgs[] memory args = decodeUserData(context.userData);

        uint inSum = 0;

        uint[] storage idxs = ctx.accountSwapIndexes[context.msgSender][superToken];

        for (uint i = 0;i < args.length;i++) {
            require(args[i].inAmount > 0, "ERR_INVALID_AMOUNT");

            inSum += args[i].inAmount;

            AccountState memory state = AccountState(
                getSuperBalance(address(superToken)), records[address(superToken)].denorm, getSuperBalance(address(args[i].destSuperToken)),
                records[address(args[i].destSuperToken)].denorm
            );

            if (i < idxs.length) {
                // update in place
                StreamSwapArgs storage entry = ctx.accountsPayable[superToken][idxs[i] - 1];
                newSfCtx = updateTrade(ctx, superToken, newSfCtx, args[i], entry, state, state);
                ctx.accountsPayable[superToken][idxs[i] - 1] = args[i];
            }
            else {
                newSfCtx = updateTrade(ctx, superToken, newSfCtx, args[i], EMPTY_ARGS, state, state);

                idxs.push(ctx.accountsPayable[superToken].length + 1);
                ctx.accountsPayable[superToken].push(args[i]);
            }
        }

        while (args.length < idxs.length) {
            uint idx = idxs[idxs.length - 1];
            idxs.pop();

            StreamSwapArgs storage entry = ctx.accountsPayable[superToken][idx - 1];
            AccountState memory state = AccountState(
                getSuperBalance(address(superToken)), records[address(superToken)].denorm, 
                getSuperBalance(entry.destSuperToken), 
                records[address(entry.destSuperToken)].denorm
            );

            updateTrade(ctx, superToken, newSfCtx, EMPTY_ARGS, entry, state, state);

            // TODO: need to find a better way to do this, it would not last in production
            // reason it does not work right now is because accountSwapIndexes cannot be resolved from here for an arb accountsPayable
            ctx.accountsPayable[superToken][idx - 1] = EMPTY_ARGS; //ctx.accountsPayable[superToken][ctx.accountsPayable[superToken].length - 1];

        }

        (,int96 inFlow,,) = ctx.cfa.getFlow(superToken, context.msgSender, address(this));
        require(inSum == uint256(inFlow), "ERR_INVALID_SUM");

        return newSfCtx;
    }

    function updateFlowRates(Context storage ctx, address superToken, mapping(address => StreamSwapLibrary.Record) storage records, uint prevBalance)
        public
    {
        StreamSwapArgs[] memory swapArgs = ctx.accountsPayable[ISuperToken(superToken)];

        uint len = swapArgs.length; // not sure if this is needed
        for(uint i = 0;i < swapArgs.length;i++) {
            AccountState memory curState = AccountState(getSuperBalance(superToken), records[superToken].denorm, getSuperBalance(swapArgs[i].destSuperToken), records[address(swapArgs[i].destSuperToken)].denorm);
            AccountState memory oldState = AccountState(prevBalance, records[superToken].denorm, getSuperBalance(swapArgs[i].destSuperToken), records[address(swapArgs[i].destSuperToken)].denorm);
            updateTrade(ctx, ISuperToken(superToken), new bytes(0), swapArgs[i], swapArgs[i],
                curState, 
                oldState
            );
        }
    }

    function getSuperBalance(address token)
        internal view
        returns (uint)
    {
        // call balanceOf is safe here because it can only be called on a SuperToken
        return IERC20(token).balanceOf(address(this));
    }


    /**********************************************************************************************
    // calcSpotPrice                                                                             //
    // sP = spotPrice                                                                            //
    // bI = tokenBalanceIn                ( bI / wI )         1                                  //
    // bO = tokenBalanceOut         sP =  -----------  *  ----------                             //
    // wI = tokenWeightIn                 ( bO / wO )     ( 1 - sF )                             //
    // wO = tokenWeightOut                                                                       //
    // sF = swapFee                                                                              //
    **********************************************************************************************/
    function calcSpotPrice(
        uint tokenBalanceIn,
        uint tokenWeightIn,
        uint tokenBalanceOut,
        uint tokenWeightOut,
        uint swapFee
    )
        public pure
        returns (uint spotPrice)
    {
        uint numer = bdiv(tokenBalanceIn, tokenWeightIn);
        uint denom = bdiv(tokenBalanceOut, tokenWeightOut);
        uint ratio = bdiv(numer, denom);
        uint scale = bdiv(BONE, bsub(BONE, swapFee));
        return  (spotPrice = bmul(ratio, scale));
    }

    /**********************************************************************************************
    // calcOutGivenIn                                                                            //
    // aO = tokenAmountOut                                                                       //
    // bO = tokenBalanceOut                                                                      //
    // bI = tokenBalanceIn              /      /            bI             \    (wI / wO) \      //
    // aI = tokenAmountIn    aO = bO * |  1 - | --------------------------  | ^            |     //
    // wI = tokenWeightIn               \      \ ( bI + ( aI * ( 1 - sF )) /              /      //
    // wO = tokenWeightOut                                                                       //
    // sF = swapFee                                                                              //
    **********************************************************************************************/
    function calcOutGivenIn(
        uint tokenBalanceIn,
        uint tokenWeightIn,
        uint tokenBalanceOut,
        uint tokenWeightOut,
        uint tokenAmountIn,
        uint swapFee
    )
        public pure
        returns (uint tokenAmountOut)
    {
        uint weightRatio = bdiv(tokenWeightIn, tokenWeightOut);
        uint adjustedIn = bsub(BONE, swapFee);
        adjustedIn = bmul(tokenAmountIn, adjustedIn);
        uint y = bdiv(tokenBalanceIn, badd(tokenBalanceIn, adjustedIn));
        uint foo = bpow(y, weightRatio);
        uint bar = bsub(BONE, foo);
        tokenAmountOut = bmul(tokenBalanceOut, bar);
        return tokenAmountOut;
    }

    /**********************************************************************************************
    // calcInGivenOut                                                                            //
    // aI = tokenAmountIn                                                                        //
    // bO = tokenBalanceOut               /  /     bO      \    (wO / wI)      \                 //
    // bI = tokenBalanceIn          bI * |  | ------------  | ^            - 1  |                //
    // aO = tokenAmountOut    aI =        \  \ ( bO - aO ) /                   /                 //
    // wI = tokenWeightIn           --------------------------------------------                 //
    // wO = tokenWeightOut                          ( 1 - sF )                                   //
    // sF = swapFee                                                                              //
    **********************************************************************************************/
    function calcInGivenOut(
        uint tokenBalanceIn,
        uint tokenWeightIn,
        uint tokenBalanceOut,
        uint tokenWeightOut,
        uint tokenAmountOut,
        uint swapFee
    )
        public pure
        returns (uint tokenAmountIn)
    {
        uint weightRatio = bdiv(tokenWeightOut, tokenWeightIn);
        uint diff = bsub(tokenBalanceOut, tokenAmountOut);
        uint y = bdiv(tokenBalanceOut, diff);
        uint foo = bpow(y, weightRatio);
        foo = bsub(foo, BONE);
        tokenAmountIn = bsub(BONE, swapFee);
        tokenAmountIn = bdiv(bmul(tokenBalanceIn, foo), tokenAmountIn);
        return tokenAmountIn;
    }

    /**********************************************************************************************
    // calcPoolOutGivenSingleIn                                                                  //
    // pAo = poolAmountOut         /                                              \              //
    // tAi = tokenAmountIn        ///      /     //    wI \      \\       \     wI \             //
    // wI = tokenWeightIn        //| tAi *| 1 - || 1 - --  | * sF || + tBi \    --  \            //
    // tW = totalWeight     pAo=||  \      \     \\    tW /      //         | ^ tW   | * pS - pS //
    // tBi = tokenBalanceIn      \\  ------------------------------------- /        /            //
    // pS = poolSupply            \\                    tBi               /        /             //
    // sF = swapFee                \                                              /              //
    **********************************************************************************************/
    function calcPoolOutGivenSingleIn(
        uint tokenBalanceIn,
        uint tokenWeightIn,
        uint poolSupply,
        uint totalWeight,
        uint tokenAmountIn,
        uint swapFee
    )
        public pure
        returns (uint poolAmountOut)
    {
        // Charge the trading fee for the proportion of tokenAi
        //  which is implicitly traded to the other pool tokens.
        // That proportion is (1- weightTokenIn)
        // tokenAiAfterFee = tAi * (1 - (1-weightTi) * poolFee);
        uint normalizedWeight = bdiv(tokenWeightIn, totalWeight);
        uint zaz = bmul(bsub(BONE, normalizedWeight), swapFee); 
        uint tokenAmountInAfterFee = bmul(tokenAmountIn, bsub(BONE, zaz));

        uint newTokenBalanceIn = badd(tokenBalanceIn, tokenAmountInAfterFee);
        uint tokenInRatio = bdiv(newTokenBalanceIn, tokenBalanceIn);

        // uint newPoolSupply = (ratioTi ^ weightTi) * poolSupply;
        uint poolRatio = bpow(tokenInRatio, normalizedWeight);
        uint newPoolSupply = bmul(poolRatio, poolSupply);
        poolAmountOut = bsub(newPoolSupply, poolSupply);
        return poolAmountOut;
    }

    /**********************************************************************************************
    // calcSingleInGivenPoolOut                                                                  //
    // tAi = tokenAmountIn              //(pS + pAo)\     /    1    \\                           //
    // pS = poolSupply                 || ---------  | ^ | --------- || * bI - bI                //
    // pAo = poolAmountOut              \\    pS    /     \(wI / tW)//                           //
    // bI = balanceIn          tAi =  --------------------------------------------               //
    // wI = weightIn                              /      wI  \                                   //
    // tW = totalWeight                          |  1 - ----  |  * sF                            //
    // sF = swapFee                               \      tW  /                                   //
    **********************************************************************************************/
    function calcSingleInGivenPoolOut(
        uint tokenBalanceIn,
        uint tokenWeightIn,
        uint poolSupply,
        uint totalWeight,
        uint poolAmountOut,
        uint swapFee
    )
        public pure
        returns (uint tokenAmountIn)
    {
        uint normalizedWeight = bdiv(tokenWeightIn, totalWeight);
        uint newPoolSupply = badd(poolSupply, poolAmountOut);
        uint poolRatio = bdiv(newPoolSupply, poolSupply);
      
        //uint newBalTi = poolRatio^(1/weightTi) * balTi;
        uint boo = bdiv(BONE, normalizedWeight); 
        uint tokenInRatio = bpow(poolRatio, boo);
        uint newTokenBalanceIn = bmul(tokenInRatio, tokenBalanceIn);
        uint tokenAmountInAfterFee = bsub(newTokenBalanceIn, tokenBalanceIn);
        // Do reverse order of fees charged in joinswap_ExternAmountIn, this way 
        //     ``` pAo == joinswap_ExternAmountIn(Ti, joinswap_PoolAmountOut(pAo, Ti)) ```
        //uint tAi = tAiAfterFee / (1 - (1-weightTi) * swapFee) ;
        uint zar = bmul(bsub(BONE, normalizedWeight), swapFee);
        tokenAmountIn = bdiv(tokenAmountInAfterFee, bsub(BONE, zar));
        return tokenAmountIn;
    }

    /**********************************************************************************************
    // calcSingleOutGivenPoolIn                                                                  //
    // tAo = tokenAmountOut            /      /                                             \\   //
    // bO = tokenBalanceOut           /      // pS - (pAi * (1 - eF)) \     /    1    \      \\  //
    // pAi = poolAmountIn            | bO - || ----------------------- | ^ | --------- | * b0 || //
    // ps = poolSupply                \      \\          pS           /     \(wO / tW)/      //  //
    // wI = tokenWeightIn      tAo =   \      \                                             //   //
    // tW = totalWeight                    /     /      wO \       \                             //
    // sF = swapFee                    *  | 1 - |  1 - ---- | * sF  |                            //
    // eF = exitFee                        \     \      tW /       /                             //
    **********************************************************************************************/
    function calcSingleOutGivenPoolIn(
        uint tokenBalanceOut,
        uint tokenWeightOut,
        uint poolSupply,
        uint totalWeight,
        uint poolAmountIn,
        uint swapFee
    )
        public pure
        returns (uint tokenAmountOut)
    {
        uint normalizedWeight = bdiv(tokenWeightOut, totalWeight);
        // charge exit fee on the pool token side
        // pAiAfterExitFee = pAi*(1-exitFee)
        uint poolAmountInAfterExitFee = bmul(poolAmountIn, bsub(BONE, EXIT_FEE));
        uint newPoolSupply = bsub(poolSupply, poolAmountInAfterExitFee);
        uint poolRatio = bdiv(newPoolSupply, poolSupply);
     
        // newBalTo = poolRatio^(1/weightTo) * balTo;
        uint tokenOutRatio = bpow(poolRatio, bdiv(BONE, normalizedWeight));
        uint newTokenBalanceOut = bmul(tokenOutRatio, tokenBalanceOut);

        uint tokenAmountOutBeforeSwapFee = bsub(tokenBalanceOut, newTokenBalanceOut);

        // charge swap fee on the output token side 
        //uint tAo = tAoBeforeSwapFee * (1 - (1-weightTo) * swapFee)
        uint zaz = bmul(bsub(BONE, normalizedWeight), swapFee); 
        tokenAmountOut = bmul(tokenAmountOutBeforeSwapFee, bsub(BONE, zaz));
        return tokenAmountOut;
    }

    /**********************************************************************************************
    // calcPoolInGivenSingleOut                                                                  //
    // pAi = poolAmountIn               // /               tAo             \\     / wO \     \   //
    // bO = tokenBalanceOut            // | bO - -------------------------- |\   | ---- |     \  //
    // tAo = tokenAmountOut      pS - ||   \     1 - ((1 - (tO / tW)) * sF)/  | ^ \ tW /  * pS | //
    // ps = poolSupply                 \\ -----------------------------------/                /  //
    // wO = tokenWeightOut  pAi =       \\               bO                 /                /   //
    // tW = totalWeight           -------------------------------------------------------------  //
    // sF = swapFee                                        ( 1 - eF )                            //
    // eF = exitFee                                                                              //
    **********************************************************************************************/
    function calcPoolInGivenSingleOut(
        uint tokenBalanceOut,
        uint tokenWeightOut,
        uint poolSupply,
        uint totalWeight,
        uint tokenAmountOut,
        uint swapFee
    )
        public pure
        returns (uint poolAmountIn)
    {

        // charge swap fee on the output token side 
        uint normalizedWeight = bdiv(tokenWeightOut, totalWeight);
        //uint tAoBeforeSwapFee = tAo / (1 - (1-weightTo) * swapFee) ;
        uint zoo = bsub(BONE, normalizedWeight);
        uint zar = bmul(zoo, swapFee); 
        uint tokenAmountOutBeforeSwapFee = bdiv(tokenAmountOut, bsub(BONE, zar));

        uint newTokenBalanceOut = bsub(tokenBalanceOut, tokenAmountOutBeforeSwapFee);
        uint tokenOutRatio = bdiv(newTokenBalanceOut, tokenBalanceOut);

        //uint newPoolSupply = (ratioTo ^ weightTo) * poolSupply;
        uint poolRatio = bpow(tokenOutRatio, normalizedWeight);
        uint newPoolSupply = bmul(poolRatio, poolSupply);
        uint poolAmountInAfterExitFee = bsub(poolSupply, newPoolSupply);

        // charge exit fee on the pool token side
        // pAi = pAiAfterExitFee/(1-exitFee)
        poolAmountIn = bdiv(poolAmountInAfterExitFee, bsub(BONE, EXIT_FEE));
        return poolAmountIn;
    }

    /** math */

    function btoi(uint a)
        internal pure 
        returns (uint)
    {
        return a / BONE;
    }

    function bfloor(uint a)
        internal pure
        returns (uint)
    {
        return btoi(a) * BONE;
    }

    function badd(uint a, uint b)
        internal pure
        returns (uint)
    {
        uint c = a + b;
        require(c >= a, "ERR_ADD_OVERFLOW");
        return c;
    }

    function bsub(uint a, uint b)
        internal pure
        returns (uint)
    {
        (uint c, bool flag) = bsubSign(a, b);
        require(!flag, "ERR_SUB_UNDERFLOW");
        return c;
    }

    function bsubSign(uint a, uint b)
        internal pure
        returns (uint, bool)
    {
        if (a >= b) {
            return (a - b, false);
        } else {
            return (b - a, true);
        }
    }

    function bmul(uint a, uint b)
        internal pure
        returns (uint)
    {
        uint c0 = a * b;
        require(a == 0 || c0 / a == b, "ERR_MUL_OVERFLOW");
        uint c1 = c0 + (BONE / 2);
        require(c1 >= c0, "ERR_MUL_OVERFLOW");
        uint c2 = c1 / BONE;
        return c2;
    }

    function bdiv(uint a, uint b)
        internal pure
        returns (uint)
    {
        require(b != 0, "ERR_DIV_ZERO");
        uint c0 = a * BONE;
        require(a == 0 || c0 / a == BONE, "ERR_DIV_INTERNAL"); // bmul overflow
        uint c1 = c0 + (b / 2);
        require(c1 >= c0, "ERR_DIV_INTERNAL"); //  badd require
        uint c2 = c1 / b;
        return c2;
    }

    // DSMath.wpow
    function bpowi(uint a, uint n)
        internal pure
        returns (uint)
    {
        uint z = n % 2 != 0 ? a : BONE;

        for (n /= 2; n != 0; n /= 2) {
            a = bmul(a, a);

            if (n % 2 != 0) {
                z = bmul(z, a);
            }
        }
        return z;
    }

    // Compute b^(e.w) by splitting it into (b^e)*(b^0.w).
    // Use `bpowi` for `b^e` and `bpowK` for k iterations
    // of approximation of b^0.w
    function bpow(uint base, uint exp)
        internal pure
        returns (uint)
    {
        require(base >= MIN_BPOW_BASE, "ERR_BPOW_BASE_TOO_LOW");
        require(base <= MAX_BPOW_BASE, "ERR_BPOW_BASE_TOO_HIGH");

        uint whole  = bfloor(exp);   
        uint remain = bsub(exp, whole);

        uint wholePow = bpowi(base, btoi(whole));

        if (remain == 0) {
            return wholePow;
        }

        uint partialResult = bpowApprox(base, remain, BPOW_PRECISION);
        return bmul(wholePow, partialResult);
    }

    function bpowApprox(uint base, uint exp, uint precision)
        internal pure
        returns (uint)
    {
        // term 0:
        uint a     = exp;
        (uint x, bool xneg)  = bsubSign(base, BONE);
        uint term = BONE;
        uint sum   = term;
        bool negative = false;


        // term(k) = numer / denom 
        //         = (product(a - i - 1, i=1-->k) * x^k) / (k!)
        // each iteration, multiply previous term by (a-(k-1)) * x / k
        // continue until term is less than precision
        for (uint i = 1; term >= precision; i++) {
            uint bigK = i * BONE;
            (uint c, bool cneg) = bsubSign(a, bsub(bigK, BONE));
            term = bmul(term, bmul(c, x));
            term = bdiv(term, bigK);
            if (term == 0) break;

            if (xneg) negative = !negative;
            if (cneg) negative = !negative;
            if (negative) {
                sum = bsub(sum, term);
            } else {
                sum = badd(sum, term);
            }
        }

        return sum;
    }
}