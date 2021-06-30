// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.
// SPDX-License-Identifier: GPLv3
pragma solidity 0.7.6;
pragma abicoder v2;

import "hardhat/console.sol";

import {
    ISuperfluid,
    ISuperToken,
    ISuperApp,
    ISuperAgreement,
    SuperAppDefinitions
} from "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperfluid.sol";
//"@superfluid-finance/ethereum-monorepo/packages/ethereum-contracts/contracts/interfaces/superfluid/ISuperfluid.sol";

import {
    IConstantFlowAgreementV1
} from "@superfluid-finance/ethereum-contracts/contracts/interfaces/agreements/IConstantFlowAgreementV1.sol";

import {
    SuperAppBase
} from "@superfluid-finance/ethereum-contracts/contracts/apps/SuperAppBase.sol";

import "./balancer/BToken.sol";
import "./balancer/BMath.sol";

import "./StreamSwapLibrary.sol";

contract StreamSwapPool is SuperAppBase, BBronze, BToken {

    using StreamSwapLibrary for StreamSwapLibrary.Context;

    struct SuperTokenVarsHelper {
        address tokenIn;
        address tokenOut;
        uint tokenInBalance;
        uint tokenOutBalance;
    }

    event LOG_SWAP(
        address indexed caller,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256         tokenAmountIn,
        uint256         tokenAmountOut
    );

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
        address indexed tokenOut,
        uint256         tokenRateOut
    );

    event LOG_BIND_NEW(
        address indexed token
    );

    event LOG_JOIN(
        address indexed caller,
        address indexed tokenIn,
        uint256         tokenAmountIn
    );

    event LOG_EXIT(
        address indexed caller,
        address indexed tokenOut,
        uint256         tokenAmountOut
    );

    event LOG_CALL(
        bytes4  indexed sig,
        address indexed caller,
        bytes           data
    ) anonymous;

    modifier _logs_() {
        emit LOG_CALL(msg.sig, msg.sender, msg.data);
        _;
    }

    modifier _lock_() {
        require(!_mutex, "ERR_REENTRY");
        _mutex = true;
        _;
        _mutex = false;
    }

    modifier _viewlock_() {
        require(!_mutex, "ERR_REENTRY");
        _;
    }

    bool private _mutex;

    address private _factory;    // BFactory address to push token exitFee to
    address private _controller; // has CONTROL role
    bool private _publicSwap; // true if PUBLIC can call SWAP functions

    // `setSwapFee` and `finalize` require CONTROL
    // `finalize` sets `PUBLIC can SWAP`, `PUBLIC can JOIN`
    uint private _swapFee;
    bool private _finalized;

    address[] private _superTokens;
    mapping(address => address) _underlyingToSuperToken;

    mapping(address => StreamSwapLibrary.Record) private  _records;
    uint private _totalWeight;

    StreamSwapLibrary.Context _streamSwapContext;

    constructor(
        ISuperfluid host,
        IConstantFlowAgreementV1 cfa
    ) {

        require(address(host) != address(0), "host is zero address");
        require(address(cfa) != address(0), "cfa is zero address");

        uint256 configWord =
            SuperAppDefinitions.APP_LEVEL_FINAL |
            SuperAppDefinitions.BEFORE_AGREEMENT_CREATED_NOOP |
            SuperAppDefinitions.BEFORE_AGREEMENT_UPDATED_NOOP |
            SuperAppDefinitions.BEFORE_AGREEMENT_TERMINATED_NOOP;

        host.registerApp(configWord);

        _streamSwapContext.host = host;
        _streamSwapContext.cfa = cfa;

        _streamSwapContext.initialize();

        // balancer construct
        _controller = msg.sender;
        _factory = msg.sender;
        _swapFee = MIN_FEE;
        _publicSwap = false;
        _finalized = false;
    }

    modifier onlyHost() {
        require(msg.sender == address(_streamSwapContext.host), "ERR HOST ONLY");
        _;
    }

    /**************************************************************************
     * SuperApp callbacks
     *************************************************************************/

    function afterAgreementCreated(
        ISuperToken _superToken,
        address, // _agreementClass,
        bytes32, // _agreementId,
        bytes calldata /*_agreementData*/,
        bytes calldata ,// _cbdata,
        bytes calldata _ctx
    )
        external override
        onlyHost
        returns (bytes memory newCtx)
    {
        console.log("agreement create");
        newCtx = _streamSwapContext.makeTrade(_superToken, _ctx, _records);
    }

    function afterAgreementUpdated(
        ISuperToken _superToken,
        address _agreementClass,
        bytes32 ,//_agreementId,
        bytes calldata , //_agreementData,
        bytes calldata ,//_cbdata,
        bytes calldata _ctx
    )
        external override
        onlyHost
        returns (bytes memory newCtx)
    {
        console.log("agreement update");
        newCtx = _streamSwapContext.makeTrade(_superToken, _ctx, _records);
    }

    function afterAgreementTerminated(
        ISuperToken _superToken,
        address _agreementClass,
        bytes32 ,//_agreementId,
        bytes calldata /*_agreementData*/,
        bytes calldata ,//_cbdata,
        bytes calldata _ctx
    )
        external override
        onlyHost
        returns (bytes memory newCtx)
    {
        console.log("agreement term");
        newCtx = _streamSwapContext.makeTrade(_superToken, _ctx, _records);
    }

    /**************************************************************************
     * Balancer Pool
     *************************************************************************/

    function isPublicSwap()
        external view
        returns (bool)
    {
        return _publicSwap;
    }

    function isFinalized()
        external view
        returns (bool)
    {
        return _finalized;
    }

    function isBound(address t)
        external view
        returns (bool)
    {
        return _records[t].bound;
    }

    function getNumTokens()
        external view
        returns (uint) 
    {
        return _superTokens.length;
    }

    function getCurrentTokens()
        external view _viewlock_
        returns (address[] memory tokens)
    {
        return _superTokens;
    }

    function getFinalTokens()
        external view
        _viewlock_
        returns (address[] memory tokens)
    {
        require(_finalized, "ERR_NOT_FINALIZED");
        return _superTokens;
    }

    function getDenormalizedWeight(address token)
        external view
        _viewlock_
        returns (uint)
    {

        require(_records[token].bound, "ERR_NOT_BOUND");
        return _records[token].denorm;
    }

    function getTotalDenormalizedWeight()
        external view
        _viewlock_
        returns (uint)
    {
        return _totalWeight;
    }

    function getNormalizedWeight(address token)
        external view
        _viewlock_
        returns (uint)
    {

        require(_records[token].bound, "ERR_NOT_BOUND");
        uint denorm = _records[token].denorm;
        return StreamSwapLibrary.bdiv(denorm, _totalWeight);
    }

    function getBalance(address token)
        external view
        _viewlock_
        returns (uint)
    {
        return getSuperBalance(_underlyingToSuperToken[token]);
    }

    function getSuperBalance(address token)
        internal view
        returns (uint)
    {
        require(_records[token].bound, "ERR_NOT_BOUND");

        // call balanceOf is safe here because it can only be called on a SuperToken
        return IERC20(token).balanceOf(address(this));
    }

    function getSwapFee()
        external view
        _viewlock_
        returns (uint)
    {
        return _swapFee;
    }

    function getController()
        external view
        _viewlock_
        returns (address)
    {
        return _controller;
    }

    function setSwapFee(uint swapFee)
        external
        _logs_
        _lock_
    { 
        require(!_finalized, "ERR_IS_FINALIZED");
        require(msg.sender == _controller, "ERR_NOT_CONTROLLER");
        require(swapFee >= MIN_FEE, "ERR_MIN_FEE");
        require(swapFee <= MAX_FEE, "ERR_MAX_FEE");
        _swapFee = swapFee;
    }

    function setController(address manager)
        external
        _logs_
        _lock_
    {
        require(msg.sender == _controller, "ERR_NOT_CONTROLLER");
        _controller = manager;
    }

    function setPublicSwap(bool public_)
        external
        _logs_
        _lock_
    {
        require(!_finalized, "ERR_IS_FINALIZED");
        require(msg.sender == _controller, "ERR_NOT_CONTROLLER");
        _publicSwap = public_;
    }

    function finalize()
        external
        _logs_
        _lock_
    {
        require(msg.sender == _controller, "ERR_NOT_CONTROLLER");
        require(!_finalized, "ERR_IS_FINALIZED");
        require(_superTokens.length >= MIN_BOUND_TOKENS, "ERR_MIN_TOKENS");

        _finalized = true;
        _publicSwap = true;

        _mintPoolShare(INIT_POOL_SUPPLY);
        _pushPoolShare(msg.sender, INIT_POOL_SUPPLY);
    }


    function bind(address token, uint balance, uint denorm)
        external
        _logs_
        // _lock_  Bind does not lock because it jumps to `rebind`, which does
    {
        require(msg.sender == _controller, "ERR_NOT_CONTROLLER");
        require(!_records[token].bound, "ERR_IS_BOUND");
        require(!_finalized, "ERR_IS_FINALIZED");

        require(_superTokens.length < MAX_BOUND_TOKENS, "ERR_MAX_TOKENS");

        require(address(_streamSwapContext.host) == ISuperToken(token).getHost(), "ERR_BAD_HOST");

        _records[token] = StreamSwapLibrary.Record({
            bound: true,
            index: _superTokens.length,
            denorm: 0,    // denorm will be validated
            balance: 0
        });
        _superTokens.push(token);
        _underlyingToSuperToken[ISuperToken(token).getUnderlyingToken()] = token;
        IERC20(ISuperToken(token).getUnderlyingToken()).approve(token, type(uint).max);
        rebind(token, balance, denorm);
    }

    function rebind(address token, uint balance, uint denorm)
        public
        _logs_
        _lock_
    {
        require(msg.sender == _controller, "ERR_NOT_CONTROLLER");
        require(_records[token].bound, "ERR_NOT_BOUND");
        require(!_finalized, "ERR_IS_FINALIZED");

        require(denorm >= MIN_WEIGHT, "ERR_MIN_WEIGHT");
        require(denorm <= MAX_WEIGHT, "ERR_MAX_WEIGHT");

        StreamSwapLibrary.Record memory oldRecord = _records[token];

        // Adjust the denorm and totalWeight
        uint oldWeight = _records[token].denorm;
        if (denorm > oldWeight) {
            _totalWeight = StreamSwapLibrary.badd(_totalWeight, StreamSwapLibrary.bsub(denorm, oldWeight));
            require(_totalWeight <= MAX_TOTAL_WEIGHT, "ERR_MAX_TOTAL_WEIGHT");
        } else if (denorm < oldWeight) {
            _totalWeight = StreamSwapLibrary.bsub(_totalWeight, StreamSwapLibrary.bsub(oldWeight, denorm));
        }        
        _records[token].denorm = denorm;

        // Adjust the balance record and actual token balance
        uint oldBalance = getSuperBalance(token);
        _records[token].balance = balance;
        if (balance > oldBalance) {
            _pullUnderlying(token, msg.sender, StreamSwapLibrary.bsub(balance, oldBalance));
        } else if (balance < oldBalance) {
            // In this case liquidity is being withdrawn, so charge EXIT_FEE
            uint tokenBalanceWithdrawn = StreamSwapLibrary.bsub(oldBalance, balance);
            uint tokenExitFee = StreamSwapLibrary.bmul(tokenBalanceWithdrawn, EXIT_FEE);
            _pushUnderlying(token, msg.sender, StreamSwapLibrary.bsub(tokenBalanceWithdrawn, tokenExitFee));
            _pushUnderlying(token, _factory, tokenExitFee);
        }

        _streamSwapContext.updateFlowRates(token, _records, oldRecord);
    }

    function unbind(address token)
        external
        _logs_
        _lock_
    {

        require(msg.sender == _controller, "ERR_NOT_CONTROLLER");
        require(_records[token].bound, "ERR_NOT_BOUND");
        require(!_finalized, "ERR_IS_FINALIZED");

        uint tokenBalance = getSuperBalance(token);
        uint tokenExitFee = StreamSwapLibrary.bmul(tokenBalance, EXIT_FEE);

        _totalWeight = StreamSwapLibrary.bsub(_totalWeight, _records[token].denorm);

        // Swap the token-to-unbind with the last token,
        // then delete the last token
        uint index = _records[token].index;
        uint last = _superTokens.length - 1;
        _superTokens[index] = _superTokens[last];
        _records[_superTokens[index]].index = index;
        _superTokens.pop();
        _records[token] = StreamSwapLibrary.Record({
            bound: false,
            index: 0,
            denorm: 0,
            balance: 0
        });

        // todo: wipe streams

        IERC20(ISuperToken(token).getUnderlyingToken()).approve(token, 0);

        _pushUnderlying(token, msg.sender, StreamSwapLibrary.bsub(tokenBalance, tokenExitFee));
        _pushUnderlying(token, _factory, tokenExitFee);
    }

    function getSpotPrice(address tokenIn, address tokenOut)
        external view
        _viewlock_
        returns (uint spotPrice)
    {
        address superTokenIn = _underlyingToSuperToken[tokenIn];
        address superTokenOut = _underlyingToSuperToken[tokenOut];

        require(_records[superTokenIn].bound, "ERR_NOT_BOUND");
        require(_records[superTokenOut].bound, "ERR_NOT_BOUND");
        StreamSwapLibrary.Record storage inRecord = _records[superTokenIn];
        StreamSwapLibrary.Record storage outRecord = _records[superTokenOut];
        return StreamSwapLibrary.calcSpotPrice(getSuperBalance(superTokenIn), inRecord.denorm, getSuperBalance(superTokenOut), outRecord.denorm, _swapFee);
    }

    function getSpotPriceSansFee(address tokenIn, address tokenOut)
        external view
        _viewlock_
        returns (uint spotPrice)
    {
        address superTokenIn = _underlyingToSuperToken[tokenIn];
        address superTokenOut = _underlyingToSuperToken[tokenOut];

        require(_records[superTokenIn].bound, "ERR_NOT_BOUND");
        require(_records[superTokenOut].bound, "ERR_NOT_BOUND");
        StreamSwapLibrary.Record storage inRecord = _records[superTokenIn];
        StreamSwapLibrary.Record storage outRecord = _records[superTokenOut];
        return StreamSwapLibrary.calcSpotPrice(getSuperBalance(superTokenIn), inRecord.denorm, getSuperBalance(superTokenOut), outRecord.denorm, 0);
    }

    function joinPool(uint poolAmountOut, uint[] calldata maxAmountsIn)
        external
        _logs_
        _lock_
    {
        require(_finalized, "ERR_NOT_FINALIZED");

        uint poolTotal = totalSupply();
        uint ratio = StreamSwapLibrary.bdiv(poolAmountOut, poolTotal);
        require(ratio != 0, "ERR_MATH_APPROX");

        for (uint i = 0; i < _superTokens.length; i++) {
            address t = _superTokens[i];
            StreamSwapLibrary.Record memory oldRecord = _records[t];
            uint bal = getSuperBalance(t);
            uint tokenAmountIn = StreamSwapLibrary.bmul(ratio, bal);
            require(tokenAmountIn != 0, "ERR_MATH_APPROX");
            require(tokenAmountIn <= maxAmountsIn[i], "ERR_LIMIT_IN");
            _records[t].balance = StreamSwapLibrary.badd(bal, tokenAmountIn);
            emit LOG_JOIN(msg.sender, t, tokenAmountIn);
            _pullUnderlying(t, msg.sender, tokenAmountIn);
            _streamSwapContext.updateFlowRates(t, _records, oldRecord);
        }
        _mintPoolShare(poolAmountOut);
        _pushPoolShare(msg.sender, poolAmountOut);
    }

    function exitPool(uint poolAmountIn, uint[] calldata minAmountsOut)
        external
        _logs_
        _lock_
    {
        require(_finalized, "ERR_NOT_FINALIZED");

        uint poolTotal = totalSupply();
        uint exitFee = StreamSwapLibrary.bmul(poolAmountIn, EXIT_FEE);
        uint pAiAfterExitFee = StreamSwapLibrary.bsub(poolAmountIn, exitFee);
        uint ratio = StreamSwapLibrary.bdiv(pAiAfterExitFee, poolTotal);
        require(ratio != 0, "ERR_MATH_APPROX");

        _pullPoolShare(msg.sender, poolAmountIn);
        _pushPoolShare(_factory, exitFee);
        _burnPoolShare(pAiAfterExitFee);

        for (uint i = 0; i < _superTokens.length; i++) {
            address t = _superTokens[i];
            StreamSwapLibrary.Record memory oldRecord = _records[t];
            uint bal = getSuperBalance(t);
            uint tokenAmountOut = StreamSwapLibrary.bmul(ratio, bal);
            require(tokenAmountOut != 0, "ERR_MATH_APPROX");
            require(tokenAmountOut >= minAmountsOut[i], "ERR_LIMIT_OUT");
            _records[t].balance = StreamSwapLibrary.bsub(bal, tokenAmountOut);
            emit LOG_EXIT(msg.sender, t, tokenAmountOut);
            _pushUnderlying(t, msg.sender, tokenAmountOut);
            _streamSwapContext.updateFlowRates(t, _records, oldRecord);
        }

    }


    function swapExactAmountIn(
        address tokenIn,
        uint tokenAmountIn,
        address tokenOut,
        uint minAmountOut,
        uint maxPrice
    )
        external
        _logs_
        _lock_
        returns (uint tokenAmountOut, uint spotPriceAfter)
    {
        SuperTokenVarsHelper memory si = SuperTokenVarsHelper(
            _underlyingToSuperToken[tokenIn],
            _underlyingToSuperToken[tokenOut],
            0,
            0
        );

        require(_records[si.tokenIn].bound, "ERR_NOT_BOUND");
        require(_records[si.tokenOut].bound, "ERR_NOT_BOUND");
        require(_publicSwap, "ERR_SWAP_NOT_PUBLIC");

        StreamSwapLibrary.Record storage inRecord = _records[address(si.tokenIn)];
        StreamSwapLibrary.Record storage outRecord = _records[address(si.tokenOut)];

        si.tokenInBalance = getSuperBalance(si.tokenIn);
        si.tokenOutBalance = getSuperBalance(si.tokenOut);

        require(tokenAmountIn <= StreamSwapLibrary.bmul(si.tokenInBalance, MAX_IN_RATIO), "ERR_MAX_IN_RATIO");

        uint spotPriceBefore = StreamSwapLibrary.calcSpotPrice(
                                    si.tokenInBalance,
                                    inRecord.denorm,
                                    si.tokenOutBalance,
                                    outRecord.denorm,
                                    _swapFee
                                );
        require(spotPriceBefore <= maxPrice, "ERR_BAD_LIMIT_PRICE");

        tokenAmountOut = StreamSwapLibrary.calcOutGivenIn(
                            si.tokenInBalance,
                            inRecord.denorm,
                            si.tokenOutBalance,
                            outRecord.denorm,
                            tokenAmountIn,
                            _swapFee
                        );
        require(tokenAmountOut >= minAmountOut, "ERR_LIMIT_OUT");

        spotPriceAfter = StreamSwapLibrary.calcSpotPrice(
                                StreamSwapLibrary.badd(si.tokenInBalance, tokenAmountIn),
                                inRecord.denorm,
                                StreamSwapLibrary.bsub(si.tokenOutBalance, tokenAmountOut),
                                outRecord.denorm,
                                _swapFee
                            );
        require(spotPriceAfter >= spotPriceBefore, "ERR_MATH_APPROX");     
        require(spotPriceAfter <= maxPrice, "ERR_LIMIT_PRICE");
        require(spotPriceBefore <= StreamSwapLibrary.bdiv(tokenAmountIn, tokenAmountOut), "ERR_MATH_APPROX");

        emit LOG_SWAP(msg.sender, tokenIn, tokenOut, tokenAmountIn, tokenAmountOut);

        StreamSwapLibrary.Record memory oldInRecord = inRecord;
        inRecord.balance = StreamSwapLibrary.badd(si.tokenInBalance, tokenAmountIn);
        _pullUnderlying(si.tokenIn, msg.sender, tokenAmountIn);
        _streamSwapContext.updateFlowRates(si.tokenIn, _records, oldInRecord);

        StreamSwapLibrary.Record memory oldOutRecord = outRecord;
        outRecord.balance = StreamSwapLibrary.bsub(si.tokenOutBalance, tokenAmountOut);
        _pushUnderlying(si.tokenOut, msg.sender, tokenAmountOut);
        _streamSwapContext.updateFlowRates(si.tokenOut, _records, oldOutRecord);

        return (tokenAmountOut, spotPriceAfter);
    }

    function swapExactAmountOut(
        address tokenIn,
        uint maxAmountIn,
        address tokenOut,
        uint tokenAmountOut,
        uint maxPrice
    )
        external
        _logs_
        _lock_ 
        returns (uint tokenAmountIn, uint spotPriceAfter)
    {
        SuperTokenVarsHelper memory si = SuperTokenVarsHelper(
            _underlyingToSuperToken[tokenIn],
            _underlyingToSuperToken[tokenOut],
            0,
            0
        );

        require(_records[si.tokenIn].bound, "ERR_NOT_BOUND");
        require(_records[si.tokenOut].bound, "ERR_NOT_BOUND");
        require(_publicSwap, "ERR_SWAP_NOT_PUBLIC");

        StreamSwapLibrary.Record storage inRecord = _records[address(si.tokenIn)];
        StreamSwapLibrary.Record storage outRecord = _records[address(si.tokenOut)];

        si.tokenInBalance = getSuperBalance(si.tokenIn);
        si.tokenOutBalance = getSuperBalance(si.tokenOut);

        require(tokenAmountOut <= StreamSwapLibrary.bmul(si.tokenOutBalance, MAX_OUT_RATIO), "ERR_MAX_OUT_RATIO");

        uint spotPriceBefore = StreamSwapLibrary.calcSpotPrice(
                                    si.tokenInBalance,
                                    inRecord.denorm,
                                    si.tokenOutBalance,
                                    outRecord.denorm,
                                    _swapFee
                                );
        require(spotPriceBefore <= maxPrice, "ERR_BAD_LIMIT_PRICE");

        tokenAmountIn = StreamSwapLibrary.calcInGivenOut(
                            si.tokenInBalance,
                            inRecord.denorm,
                            si.tokenOutBalance,
                            outRecord.denorm,
                            tokenAmountOut,
                            _swapFee
                        );
        require(tokenAmountIn <= maxAmountIn, "ERR_LIMIT_IN");

        spotPriceAfter = StreamSwapLibrary.calcSpotPrice(
                                StreamSwapLibrary.badd(si.tokenInBalance, tokenAmountIn),
                                inRecord.denorm,
                                StreamSwapLibrary.bsub(si.tokenOutBalance, tokenAmountOut),
                                outRecord.denorm,
                                _swapFee
                            );
        require(spotPriceAfter >= spotPriceBefore, "ERR_MATH_APPROX");
        require(spotPriceAfter <= maxPrice, "ERR_LIMIT_PRICE");
        require(spotPriceBefore <= StreamSwapLibrary.bdiv(tokenAmountIn, tokenAmountOut), "ERR_MATH_APPROX");

        emit LOG_SWAP(msg.sender, tokenIn, tokenOut, tokenAmountIn, tokenAmountOut);

        StreamSwapLibrary.Record memory oldInRecord = inRecord;
        inRecord.balance = StreamSwapLibrary.badd(si.tokenInBalance, tokenAmountIn);
        _pullUnderlying(si.tokenIn, msg.sender, tokenAmountIn);
        _streamSwapContext.updateFlowRates(si.tokenIn, _records, oldInRecord);

        StreamSwapLibrary.Record memory oldOutRecord = outRecord;
        outRecord.balance = StreamSwapLibrary.bsub(si.tokenOutBalance, tokenAmountOut);
        _pushUnderlying(si.tokenOut, msg.sender, tokenAmountOut);
        _streamSwapContext.updateFlowRates(si.tokenOut, _records, oldOutRecord);

        return (tokenAmountIn, spotPriceAfter);
    }


    function joinswapExternAmountIn(address tokenIn, uint tokenAmountIn, uint minPoolAmountOut)
        external
        _logs_
        _lock_
        returns (uint poolAmountOut)

    {
        address superTokenIn = _underlyingToSuperToken[tokenIn];

        uint tokenInBalance = getSuperBalance(superTokenIn);

        require(_finalized, "ERR_NOT_FINALIZED");
        require(_records[tokenIn].bound, "ERR_NOT_BOUND");
        require(tokenAmountIn <= StreamSwapLibrary.bmul(tokenInBalance, MAX_IN_RATIO), "ERR_MAX_IN_RATIO");

        StreamSwapLibrary.Record storage inRecord = _records[superTokenIn];

        poolAmountOut = StreamSwapLibrary.calcPoolOutGivenSingleIn(
                            tokenInBalance,
                            inRecord.denorm,
                            _totalSupply,
                            _totalWeight,
                            tokenAmountIn,
                            _swapFee
                        );

        require(poolAmountOut >= minPoolAmountOut, "ERR_LIMIT_OUT");

        inRecord.balance = StreamSwapLibrary.badd(tokenInBalance, tokenAmountIn);

        emit LOG_JOIN(msg.sender, tokenIn, tokenAmountIn);

        _mintPoolShare(poolAmountOut);
        _pushPoolShare(msg.sender, poolAmountOut);
        _pullUnderlying(superTokenIn, msg.sender, tokenAmountIn);

        _streamSwapContext.updateFlowRates(superTokenIn, _records, StreamSwapLibrary.Record(true, 0, inRecord.denorm, tokenInBalance));

        return poolAmountOut;
    }

    function joinswapPoolAmountOut(address tokenIn, uint poolAmountOut, uint maxAmountIn)
        external
        _logs_
        _lock_
        returns (uint tokenAmountIn)
    {
        address superTokenIn = _underlyingToSuperToken[tokenIn];

        uint tokenInBalance = getSuperBalance(superTokenIn);

        require(_finalized, "ERR_NOT_FINALIZED");
        require(_records[superTokenIn].bound, "ERR_NOT_BOUND");

        StreamSwapLibrary.Record storage inRecord = _records[superTokenIn];

        tokenAmountIn = StreamSwapLibrary.calcSingleInGivenPoolOut(
                            tokenInBalance,
                            inRecord.denorm,
                            _totalSupply,
                            _totalWeight,
                            poolAmountOut,
                            _swapFee
                        );

        require(tokenAmountIn != 0, "ERR_MATH_APPROX");
        require(tokenAmountIn <= maxAmountIn, "ERR_LIMIT_IN");
        
        require(tokenAmountIn <= StreamSwapLibrary.bmul(tokenInBalance, MAX_IN_RATIO), "ERR_MAX_IN_RATIO");

        inRecord.balance = StreamSwapLibrary.badd(tokenInBalance, tokenAmountIn);

        emit LOG_JOIN(msg.sender, tokenIn, tokenAmountIn);

        _mintPoolShare(poolAmountOut);
        _pushPoolShare(msg.sender, poolAmountOut);
        _pullUnderlying(superTokenIn, msg.sender, tokenAmountIn);

        _streamSwapContext.updateFlowRates(superTokenIn, _records, StreamSwapLibrary.Record(true, 0, inRecord.denorm, tokenInBalance));

        return tokenAmountIn;
    }

    function exitswapPoolAmountIn(address tokenOut, uint poolAmountIn, uint minAmountOut)
        external
        _logs_
        _lock_
        returns (uint tokenAmountOut)
    {
        address superTokenOut = _underlyingToSuperToken[tokenOut];

        uint tokenOutBalance = getSuperBalance(superTokenOut);

        require(_finalized, "ERR_NOT_FINALIZED");
        require(_records[superTokenOut].bound, "ERR_NOT_BOUND");

        StreamSwapLibrary.Record storage outRecord = _records[superTokenOut];

        tokenAmountOut = StreamSwapLibrary.calcSingleOutGivenPoolIn(
                            tokenOutBalance,
                            outRecord.denorm,
                            _totalSupply,
                            _totalWeight,
                            poolAmountIn,
                            _swapFee
                        );

        require(tokenAmountOut >= minAmountOut, "ERR_LIMIT_OUT");
        
        require(tokenAmountOut <= StreamSwapLibrary.bmul(tokenOutBalance, MAX_OUT_RATIO), "ERR_MAX_OUT_RATIO");

        outRecord.balance = StreamSwapLibrary.bsub(tokenOutBalance, tokenAmountOut);

        uint exitFee = StreamSwapLibrary.bmul(poolAmountIn, EXIT_FEE);

        emit LOG_EXIT(msg.sender, tokenOut, tokenAmountOut);

        _pullPoolShare(msg.sender, poolAmountIn);
        _burnPoolShare(bsub(poolAmountIn, exitFee));
        _pushPoolShare(_factory, exitFee);
        _pushUnderlying(superTokenOut, msg.sender, tokenAmountOut);

        _streamSwapContext.updateFlowRates(superTokenOut, _records, StreamSwapLibrary.Record(true, 0, outRecord.denorm, tokenOutBalance));

        return tokenAmountOut;
    }

    function exitswapExternAmountOut(address tokenOut, uint tokenAmountOut, uint maxPoolAmountIn)
        external
        _logs_
        _lock_
        returns (uint poolAmountIn)
    {
        address superTokenOut = _underlyingToSuperToken[tokenOut];

        uint tokenOutBalance = getSuperBalance(superTokenOut);

        require(_finalized, "ERR_NOT_FINALIZED");
        require(_records[tokenOut].bound, "ERR_NOT_BOUND");
        require(tokenAmountOut <= StreamSwapLibrary.bmul(tokenOutBalance, MAX_OUT_RATIO), "ERR_MAX_OUT_RATIO");

        StreamSwapLibrary.Record storage outRecord = _records[superTokenOut];

        poolAmountIn = StreamSwapLibrary.calcPoolInGivenSingleOut(
                            tokenOutBalance,
                            outRecord.denorm,
                            _totalSupply,
                            _totalWeight,
                            tokenAmountOut,
                            _swapFee
                        );

        require(poolAmountIn != 0, "ERR_MATH_APPROX");
        require(poolAmountIn <= maxPoolAmountIn, "ERR_LIMIT_IN");

        outRecord.balance = StreamSwapLibrary.bsub(tokenOutBalance, tokenAmountOut);

        uint exitFee = StreamSwapLibrary.bmul(poolAmountIn, EXIT_FEE);

        emit LOG_EXIT(msg.sender, tokenOut, tokenAmountOut);

        _pullPoolShare(msg.sender, poolAmountIn);
        _burnPoolShare(bsub(poolAmountIn, exitFee));
        _pushPoolShare(_factory, exitFee);
        _pushUnderlying(superTokenOut, msg.sender, tokenAmountOut);

        _streamSwapContext.updateFlowRates(superTokenOut, _records, StreamSwapLibrary.Record(true, 0, outRecord.denorm, tokenOutBalance));

        return poolAmountIn;
    }


    // ==
    // 'Underlying' token-manipulation functions make external calls but are NOT locked
    // You must `_lock_` or otherwise ensure reentry-safety

    function _pullUnderlying(address superErc20, address from, uint amount)
        internal
    {
        console.log("pull", superErc20, amount);
        IERC20 erc20 = IERC20(ISuperToken(superErc20).getUnderlyingToken());
        bool xfer = erc20.transferFrom(from, address(this), amount);
        require(xfer, "ERR_ERC20_FALSE");
        ISuperToken(superErc20).upgrade(amount);
    }

    function _pushUnderlying(address superErc20, address to, uint amount)
        internal
    {
        console.log("push", superErc20, amount);
        ISuperToken(superErc20).downgrade(amount);
        IERC20 erc20 = IERC20(ISuperToken(superErc20).getUnderlyingToken());
        bool xfer = IERC20(erc20).transfer(to, amount);
        require(xfer, "ERR_ERC20_FALSE");
    }

    function _pullPoolShare(address from, uint amount)
        internal
    {
        _pull(from, amount);
    }

    function _pushPoolShare(address to, uint amount)
        internal
    {
        _push(to, amount);
    }

    function _mintPoolShare(uint amount)
        internal
    {
        _mint(amount);
    }

    function _burnPoolShare(uint amount)
        internal
    {
        _burn(amount);
    }

}
