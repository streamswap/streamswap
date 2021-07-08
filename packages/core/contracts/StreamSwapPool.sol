// SPDX-License-Identifier: GPL-3.0

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
pragma solidity ^0.7.0;
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

import "./StreamSwapLibrary.sol";
import "./StableMath.sol";

import "@balancer-labs/v2-vault/contracts/interfaces/IVault.sol";
import "@balancer-labs/v2-vault/contracts/interfaces/IGeneralPool.sol";
import "@balancer-labs/v2-solidity-utils/contracts/helpers/InputHelpers.sol";
import "@balancer-labs/v2-solidity-utils/contracts/helpers/WordCodec.sol";

import { BasePool } from "@balancer-labs/v2-pool-utils/contracts/BasePool.sol";

contract StreamSwapPool is IGeneralPool, BasePool {

    using StreamSwapLibrary for StreamSwapLibrary.Context;
    using WordCodec for bytes32;

    struct SuperTokenVarsHelper {
        address tokenIn;
        address tokenOut;
        uint tokenInBalance;
        uint tokenOutBalance;
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

    event LOG_SWAP(
        address indexed caller,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256         tokenAmountIn,
        uint256         tokenAmountOut
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

    enum JoinKind { INIT, EXACT_TOKENS_IN_FOR_BPT_OUT, TOKEN_IN_FOR_EXACT_BPT_OUT }
    enum ExitKind { EXACT_BPT_IN_FOR_ONE_TOKEN_OUT, EXACT_BPT_IN_FOR_TOKENS_OUT, BPT_IN_FOR_EXACT_TOKENS_OUT }

    StreamSwapLibrary.Context streamSwapContext;

    bytes32 public poolId;

    constructor(
        IVault vault,
        ISuperfluid host,
        IConstantFlowAgreementV1 cfa,
        IERC20[] memory tokens,
        address[] memory assetManagers
    ) BasePool(
        vault,
        IVault.PoolSpecialization.GENERAL,
        "StreamSwapPool",
        "SSP",
        tokens,
        assetManagers,
        0, //swapFeePercentage,
        600, //pauseWindowDuration,
        600, //bufferPeriodDuration,
        msg.sender
    ) {

        require(address(vault) != address(0), "vault is zero address");
        require(address(host) != address(0), "host is zero address");
        require(address(cfa) != address(0), "cfa is zero address");

        uint256 configWord =
            SuperAppDefinitions.APP_LEVEL_FINAL |
            SuperAppDefinitions.BEFORE_AGREEMENT_CREATED_NOOP |
            SuperAppDefinitions.BEFORE_AGREEMENT_UPDATED_NOOP |
            SuperAppDefinitions.BEFORE_AGREEMENT_TERMINATED_NOOP;

        host.registerApp(configWord);

        poolId = vault.registerPool(IVault.PoolSpecialization.GENERAL);

        streamSwapContext.vault = vault;
        streamSwapContext.host = host;
        streamSwapContext.cfa = cfa;

        streamSwapContext.initialize();

        for (uint i = 0;i < assetManagers.length;i++) {
            streamSwapContext.addAssetManager(assetManagers[i]);
        }
    }

    modifier onlyHost() {
        require(msg.sender == address(streamSwapContext.host), "ERR_HOST_ONLY");
        _;
    }

    modifier onlyAssetManagers() {
        require(streamSwapContext.managers[msg.sender], "ERR_NOT_ASSET_MANAGER");
        _;
    }

    // called to registerTokens
    function finalize() public onlyHost {
        IERC20[] memory tokens = new IERC20[](streamSwapContext.assetManagers.length);

        for (uint i = 0;i < streamSwapContext.assetManagers.length;i++) {
            tokens[i] = streamSwapContext.assetManagers[i].getToken();
        }

        streamSwapContext.vault.registerTokens(poolId, tokens, streamSwapContext.assetManagers);
    }

    function makeTrade(
        ISuperToken superToken, bytes memory newSfCtx
    ) external onlyAssetManagers
        returns (bytes memory newCtx) {
        newCtx = streamSwapContext.makeTrade(superToken, newSfCtx);
    }

    /** Balancer V2 */

    function _validateIndexes(
        uint256 indexIn,
        uint256 indexOut,
        uint256 limit
    ) private pure {
        require(indexIn < limit && indexOut < limit, "ERR_OUT_OF_BOUNDS");
    }

    function onSwap(
        SwapRequest memory swapRequest,
        uint256[] memory balances,
        uint256 indexIn,
        uint256 indexOut
    ) external virtual override returns (uint256 amount) {

        require(msg.sender == address(streamSwapContext.vault), "ERR_NOT_VAULT");

        streamSwapContext.updateFlowRates(streamSwapContext.tokens[indexIn], streamSwapContext.tokens[indexOut], StreamSwapLibrary.Record(
            0,0,
            streamSwapContext.records[].denorm,
            streamSwapContext.records[].balance + 
                (swapRequest.kind == IVault.SwapKind.GIVEN_IN ? swapRequest.amount : StreamSwapLibrary.getAmountOut(swapRequest.amount, balances[indexIn], balances[indexOut]))
        ));
        streamSwapContext.updateFlowRates(streamSwapContext.tokens[indexIn], streamSwapContext.tokens[indexOut], StreamSwapLibrary.Record(
            0,0,
            streamSwapContext.records[].denorm,
            streamSwapContext.records[].balance - 
                (swapRequest.kind == IVault.SwapKind.GIVEN_IN  ? swapRequest.amount : StreamSwapLibrary.getAmountIn(swapRequest.amount, balances[indexIn], balances[indexOut]))
        ));

        _validateIndexes(indexIn, indexOut, _getTotalTokens());
        uint256[] memory scalingFactors = _scalingFactors();

        return
            swapRequest.kind == IVault.SwapKind.GIVEN_IN
                ? _swapGivenIn(swapRequest, balances, indexIn, indexOut, scalingFactors)
                : _swapGivenOut(swapRequest, balances, indexIn, indexOut, scalingFactors);
    }

    function _swapGivenIn(
        SwapRequest memory swapRequest,
        uint256[] memory balances,
        uint256 indexIn,
        uint256 indexOut,
        uint256[] memory scalingFactors
    ) internal view returns (uint256) {
        // Fees are subtracted before scaling, to reduce the complexity of the rounding direction analysis.
        swapRequest.amount = _subtractSwapFeeAmount(swapRequest.amount);

        _upscaleArray(balances, scalingFactors);
        swapRequest.amount = _upscale(swapRequest.amount, scalingFactors[indexIn]);

        uint256 amountOut = _onSwapGivenIn(swapRequest, balances, indexIn, indexOut);

        // amountOut tokens are exiting the Pool, so we round down.
        return _downscaleDown(amountOut, scalingFactors[indexOut]);
    }

    function _swapGivenOut(
        SwapRequest memory swapRequest,
        uint256[] memory balances,
        uint256 indexIn,
        uint256 indexOut,
        uint256[] memory scalingFactors
    ) internal view returns (uint256) {
        _upscaleArray(balances, scalingFactors);
        swapRequest.amount = _upscale(swapRequest.amount, scalingFactors[indexOut]);

        uint256 amountIn = _onSwapGivenOut(swapRequest, balances, indexIn, indexOut);

        // amountIn tokens are entering the Pool, so we round up.
        amountIn = _downscaleUp(amountIn, scalingFactors[indexIn]);

        // Fees are added after scaling happens, to reduce the complexity of the rounding direction analysis.
        return _addSwapFeeAmount(amountIn);
    }

    function _onSwapGivenIn(
        SwapRequest memory swapRequest,
        uint256[] memory balances,
        uint256 indexIn,
        uint256 indexOut
    ) internal view virtual returns (uint256) {
        return StreamSwapLibrary.getAmountOut(swapRequest.amount, balances[indexIn], balances[indexOut]);
    }

    function _onSwapGivenOut(
        SwapRequest memory swapRequest,
        uint256[] memory balances,
        uint256 indexIn,
        uint256 indexOut
    ) internal view virtual returns (uint256) {
        return StreamSwapLibrary.getAmountIn(swapRequest.amount, balances[indexIn], balances[indexOut]);
    }

    function _onInitializePool(
        bytes32,
        address,
        address,
        bytes memory userData
    ) internal virtual override whenNotPaused returns (uint256, uint256[] memory) {
        uint256[] memory amountsIn = userData.initialAmountsIn();
        return (100, amountsIn);
    }

    function _getAmplificationParameter() public view returns (uint) {
        return 10**18;
    }

    function _onJoinPool(
        bytes32,
        address,
        address,
        uint256[] memory balances,
        uint256,
        uint256 protocolSwapFeePercentage,
        //uint256[] memory scalingFactors,
        bytes memory userData
    )
        internal
        virtual
        override
        whenNotPaused
        returns (
            uint256,
            uint256[] memory,
            uint256[] memory
        )
    {
        (uint256 bptAmountOut, uint256[] memory amountsIn) = _doJoin(balances, /*scalingFactors, */userData);
        return (bptAmountOut, amountsIn, 0);
    }

    function _doJoin(
        uint256[] memory balances,
        bytes memory userData
    ) private view returns (uint256, uint256[] memory) {
        JoinKind kind = userData.joinKind();

        /*if (kind == JoinKind.EXACT_TOKENS_IN_FOR_BPT_OUT) {
            return _joinExactTokensInForBPTOut(balances, scalingFactors, userData);
        } else*/ if (kind == JoinKind.TOKEN_IN_FOR_EXACT_BPT_OUT) {
            return _joinTokenInForExactBPTOut(balances, userData);
        } else {
            revert("UNHANDLED_JOIN_KIND");
        }
    }

    function _joinExactTokensInForBPTOut(
        uint256[] memory balances,
        uint256[] memory scalingFactors,
        bytes memory userData
    ) private view returns (uint256, uint256[] memory) {
        (uint256[] memory amountsIn, uint256 minBPTAmountOut) = userData.exactTokensInForBptOut();
        InputHelpers.ensureInputLengthMatch(_getTotalTokens(), amountsIn.length);

        _upscaleArray(amountsIn, scalingFactors);

        (uint256 currentAmp, ) = _getAmplificationParameter();
        uint256 bptAmountOut = StableMath._calcBptOutGivenExactTokensIn(
            currentAmp,
            balances,
            amountsIn,
            totalSupply(),
            this.getSwapFeePercentage()
        );

        _require(bptAmountOut >= minBPTAmountOut, Errors.BPT_OUT_MIN_AMOUNT);

        return (bptAmountOut, amountsIn);
    }

    function _joinTokenInForExactBPTOut(uint256[] memory balances, bytes memory userData)
        private
        view
        returns (uint256, uint256[] memory)
    {
        (uint256 bptAmountOut, uint256 tokenIndex) = userData.tokenInForExactBptOut();
        // Note that there is no maximum amountIn parameter: this is handled by `IVault.joinPool`.

        _require(tokenIndex < _getTotalTokens(), Errors.OUT_OF_BOUNDS);

        uint256[] memory amountsIn = new uint256[](_getTotalTokens());
        (uint256 currentAmp, ) = _getAmplificationParameter();
        amountsIn[tokenIndex] = StableMath._calcTokenInGivenExactBptOut(
            currentAmp,
            balances,
            tokenIndex,
            bptAmountOut,
            totalSupply(),
            this.getSwapFeePercentage()
        );

        return (bptAmountOut, amountsIn);
    }
    function _onExitPool(
        bytes32,
        address,
        address,
        uint256[] memory balances,
        uint256,
        uint256 protocolSwapFeePercentage,
        bytes memory userData
    )
        internal
        virtual
        override
        returns (
            uint256 bptAmountIn,
            uint256[] memory amountsOut,
            uint256[] memory dueProtocolFeeAmounts
        )
    {
        // Exits are not completely disabled while the contract is paused: proportional exits (exact BPT in for tokens
        // out) remain functional.

        (bptAmountIn, amountsOut) = _doExit(balances, /*scalingFactors, */userData);
        return (bptAmountIn, amountsOut, 0);
    }

    function _doExit(
        uint256[] memory balances,
        bytes memory userData
    ) private view returns (uint256, uint256[] memory) {
        ExitKind kind = userData.exitKind();

        if (kind == ExitKind.EXACT_BPT_IN_FOR_ONE_TOKEN_OUT) {
            return _exitExactBPTInForTokenOut(balances, userData);
        } else {// if (kind == ExitKind.EXACT_BPT_IN_FOR_TOKENS_OUT) {
            return _exitExactBPTInForTokensOut(balances, userData);
        }/* else {
            // ExitKind.BPT_IN_FOR_EXACT_TOKENS_OUT
            return _exitBPTInForExactTokensOut(balances, scalingFactors, userData);
        }*/
    }

    function _exitExactBPTInForTokenOut(uint256[] memory balances, bytes memory userData)
        private
        view
        whenNotPaused
        returns (uint256, uint256[] memory)
    {
        // This exit function is disabled if the contract is paused.

        (uint256 bptAmountIn, uint256 tokenIndex) = userData.exactBptInForTokenOut();
        // Note that there is no minimum amountOut parameter: this is handled by `IVault.exitPool`.

        _require(tokenIndex < _getTotalTokens(), Errors.OUT_OF_BOUNDS);

        // We exit in a single token, so initialize amountsOut with zeros
        uint256[] memory amountsOut = new uint256[](_getTotalTokens());

        // And then assign the result to the selected token
        (uint256 currentAmp, ) = _getAmplificationParameter();
        amountsOut[tokenIndex] = StableMath._calcTokenOutGivenExactBptIn(
            currentAmp,
            balances,
            tokenIndex,
            bptAmountIn,
            totalSupply(),
            this.getSwapFeePercentage()
        );

        return (bptAmountIn, amountsOut);
    }

    function _exitExactBPTInForTokensOut(uint256[] memory balances, bytes memory userData)
        private
        view
        returns (uint256, uint256[] memory)
    {
        // This exit function is the only one that is not disabled if the contract is paused: it remains unrestricted
        // in an attempt to provide users with a mechanism to retrieve their tokens in case of an emergency.
        // This particular exit function is the only one that remains available because it is the simplest one, and
        // therefore the one with the lowest likelihood of errors.

        uint256 bptAmountIn = userData.exactBptInForTokensOut();
        // Note that there is no minimum amountOut parameter: this is handled by `IVault.exitPool`.

        uint256[] memory amountsOut = StableMath._calcTokensOutGivenExactBptIn(balances, bptAmountIn, totalSupply());
        return (bptAmountIn, amountsOut);
    }
}
