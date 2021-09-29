
// SPDX-License-Identifier: GPL-3.0-or-later
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

pragma solidity >=0.7.0;
pragma experimental ABIEncoderV2;

import "@balancer-labs/v2-vault/contracts/interfaces/IPoolSwapStructs.sol";
import "@balancer-labs/v2-vault/contracts/interfaces/IVault.sol";
import "@balancer-labs/v2-vault/contracts/interfaces/IBasePool.sol";
import "@balancer-labs/v2-vault/contracts/interfaces/IGeneralPool.sol";

import "@balancer-labs/v2-solidity-utils/contracts/math/FixedPoint.sol";
import "@balancer-labs/v2-solidity-utils/contracts/helpers/InputHelpers.sol";

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./interfaces/IStreamswapPool.sol";
import "./interfaces/IStreamswapAssetManager.sol";
import "./StreamswapAssetManager.sol";
import { WeightedMath } from "./WeightedMath.sol";

import "hardhat/console.sol";

import { ISuperToken } from "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperToken.sol";
import { ISuperfluid } from  "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperfluid.sol";

import { IConstantDistributionAgreementV1 } from "./stub/IConstantDistributionAgreementV1.sol";

struct StreamswapArgs {
    ISuperToken destSuperToken;
    uint128 minOut;
}

struct PoolTokenInfo {
    uint128 weight;
    uint128 balance;

    IStreamswapAssetManager assetManager;
}

/**
 * @dev Basic Weighted Pool with immutable weights.
 */
contract StreamswapPool is IStreamswapPool, WeightedMath, Ownable, ERC20, IBasePool, IGeneralPool {
    using FixedPoint for uint256;

    bytes32 public override immutable poolId;

    IVault public immutable vault;

    ISuperfluid public immutable host;
    IConstantDistributionAgreementV1 public immutable cda;

    uint public totalWeight;

    mapping(address => IERC20) assetManagers;

    IERC20[] tokens;
    mapping(IERC20 => PoolTokenInfo) public tokenInfos;

    constructor(
        IVault _vault,
        ISuperfluid _host,
        IConstantDistributionAgreementV1 _cda
    ) ERC20("Streamswap Pool Token", "SPT") {
        vault = _vault;
        host = _host;
        cda = _cda;

        poolId = _vault.registerPool(IVault.PoolSpecialization.GENERAL);
    }

    modifier onlyVault {
        require(msg.sender == address(vault), "only vault");
        _;
    }

    modifier onlyAssetManagers {
        require(_isAssetManager(msg.sender), "only asset managers");
        _;
    }

    function _isAssetManager(address possibleAssetManager) internal returns (bool) {
        return assetManagers[possibleAssetManager] != IERC20(0);
    }

    function _deployAssetManager(ISuperToken token) internal returns (IStreamswapAssetManager) {
        return IStreamswapAssetManager(new StreamswapAssetManager(
            vault,
            IStreamswapPool(this),
            host,
            cda,
            token
        ));
    }

    function _addToken(IERC20 token, uint weight) internal virtual {
        tokenInfos[token].weight = uint128(weight);
        tokenInfos[token].balance = uint128(0);

        totalWeight = totalWeight.add(weight);
        
        IStreamswapAssetManager am = _deployAssetManager(ISuperToken(address(token)));

        tokenInfos[token].assetManager = am;
    }

    function addTokens(IERC20[] calldata _tokens, uint[] calldata weights, uint[] calldata initialDeposits) external virtual onlyOwner {
        InputHelpers.ensureInputLengthMatch(tokens.length, weights.length);
        InputHelpers.ensureInputLengthMatch(tokens.length, initialDeposits.length);

        // TODO: weights must be reasonable or else it could cause overrun

        // Ensure  each normalized weight is above them minimum and find the token index of the maximum weight

        address[] memory assetManagers = new address[](_tokens.length);
        uint _totalWeight;
        for (uint8 i = 0; i < _tokens.length; i++) {
            _addToken(tokens[i], weights[i]);
            _totalWeight = _totalWeight.add(weights[i]);
            tokens.push(_tokens[i]);
        }
        totalWeight = totalWeight.add(_totalWeight);

        vault.registerTokens(poolId, _tokens, assetManagers);

        // TODO: deal with initial deposit hwen it becomes a thing
    }

    function decodeStreamSwapData(bytes memory d) internal pure returns (StreamswapArgs memory ssa) {
        (
            ssa.destSuperToken,
            ssa.minOut
        ) = abi.decode(d, (ISuperToken, uint128));
    }

    function makeTrade(ISuperToken superToken, bytes memory ctx) external override onlyAssetManagers returns (bytes memory) {
        // figure out who is trading and what rate
        ISuperfluid.Context memory context = host.decodeCtx(ctx);
        StreamswapArgs memory args = decodeStreamSwapData(context.userData);

        console.log("streamswapargs: decoded");

        (,int96 inFlow,,) = cda.getFlow(superToken, context.msgSender, address(this), 0); // todo: put actual flow id

        // create swap request
        IPoolSwapStructs.SwapRequest memory swapRequest = SwapRequest({
            kind: IVault.SwapKind.GIVEN_IN,
            tokenIn: IERC20(superToken.getUnderlyingToken()),
            tokenOut: IERC20(args.destSuperToken.getUnderlyingToken()),
            amount: uint(inFlow),
            // Misc data
            poolId: 0,
            lastChangeBlock: 0,
            from: context.msgSender,
            to: context.msgSender,
            userData: new bytes(0)
        });

        // issue out
        (,,,address assetManager) = vault.getPoolTokenInfo(poolId, IERC20(args.destSuperToken.getUnderlyingToken()));
        ctx = IStreamswapAssetManager(assetManager).setFlowRate(swapRequest, ctx);

        return ctx;
    }

    /**************************************************************************
     * Balancer Vault callbacks
     *************************************************************************/

    function onJoinPool(
        bytes32 poolId,
        address sender,
        address recipient,
        uint256[] memory balances,
        uint256 lastChangeBlock,
        uint256 protocolSwapFeePercentage,
        bytes memory userData
    ) external override onlyVault returns (uint256[] memory amountsIn, uint256[] memory dueProtocolFeeAmounts) {

    }

    function onExitPool(
        bytes32 poolId,
        address sender,
        address recipient,
        uint256[] memory balances,
        uint256 lastChangeBlock,
        uint256 protocolSwapFeePercentage,
        bytes memory userData
    ) external override onlyVault returns (uint256[] memory amountsOut, uint256[] memory dueProtocolFeeAmounts) {

    }

    function onSwap(
        SwapRequest memory swapRequest,
        uint256[] memory balances,
        uint256 indexIn,
        uint256 indexOut
    ) external override onlyVault returns (uint256 amount) {
        //_validateIndexes(indexIn, indexOut, _getTotalTokens());
        //uint256[] memory scalingFactors = _scalingFactors(); // TODO relevant for supertokens which scale

        uint inBalance = balances[indexIn];
        uint inWeight = _getNormalizedWeight(swapRequest.tokenIn);
        uint outBalance = balances[indexOut];
        uint outWeight = _getNormalizedWeight(swapRequest.tokenOut);

        // adjust rates flow based on trade results
        uint changeIn;
        uint changeOut;
        if (swapRequest.kind == IVault.SwapKind.GIVEN_IN) {
            changeIn = swapRequest.amount;
            changeOut = WeightedMath._calcOutGivenIn(inBalance, inWeight, outBalance, outWeight, swapRequest.amount);
        } else {
            changeIn = WeightedMath._calcInGivenOut(inBalance, inWeight, outBalance, outWeight, swapRequest.amount);
            changeOut = swapRequest.amount;
        }

        tokenInfos[swapRequest.tokenIn].balance = uint128(inBalance + changeIn);
        tokenInfos[swapRequest.tokenOut].balance = uint128(outBalance - changeOut);

        // update in flow rates

        uint[] memory groupIds = new uint[](4);
        groupIds[0] = uint(address(swapRequest.tokenIn));
        groupIds[1] = uint(address(swapRequest.tokenOut));
        groupIds[2] = uint(address(swapRequest.tokenIn)) + 1;
        groupIds[3] = uint(address(swapRequest.tokenOut)) + 1;

        int96[] memory flowRateModifiers = new int96[](4);
        flowRateModifiers[0] = int96(FixedPoint.ONE * inBalance / inWeight);
        flowRateModifiers[1] = int96(FixedPoint.ONE * outBalance / outWeight);
        flowRateModifiers[2] = int96(FixedPoint.ONE * inWeight / inBalance);
        flowRateModifiers[3] = int96(FixedPoint.ONE * outWeight / outBalance);

        cda.updateGroupFlowRates(groupIds, flowRateModifiers, new bytes(0));

        return swapRequest.kind == IVault.SwapKind.GIVEN_IN ? changeOut : changeIn;
    }

    function _getNormalizedWeight(IERC20 token) internal view returns (uint) {
        return FixedPoint.ONE * tokenInfos[token].weight / totalWeight;
    }
}