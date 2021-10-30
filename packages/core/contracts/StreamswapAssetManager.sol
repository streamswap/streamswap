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

import { 
    ISuperfluid,
    ISuperToken,
    SuperAppDefinitions
} from "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperfluid.sol";

import {
    SuperAppBase
} from "@superfluid-finance/ethereum-contracts/contracts/apps/SuperAppBase.sol";

import {
    IConstantDistributionAgreementV1
} from "./stub/IConstantDistributionAgreementV1.sol";

import "./RewardsAssetManager.sol";

import { StreamswapPool } from "./StreamswapPool.sol";

import "./interfaces/IStreamswapAssetManager.sol";
import "./interfaces/IStreamswapPool.sol";

import "hardhat/console.sol";

pragma solidity >=0.7.0;
pragma experimental ABIEncoderV2;

contract StreamswapAssetManager is IStreamswapAssetManager, RewardsAssetManager, SuperAppBase {
    uint16 public constant REFERRAL_CODE = 0;

    IStreamswapPool pool;
    ISuperToken public superToken;

    ISuperfluid public host;
    IConstantDistributionAgreementV1 public cda;

    constructor(
        IVault _vault,
        IStreamswapPool _pool,
        ISuperfluid _host,
        IConstantDistributionAgreementV1 _cda,
        ISuperToken _superToken
    ) RewardsAssetManager(_vault, _pool.poolId(), IERC20(address(_superToken.getUnderlyingToken()))) {
        //super;
        pool = _pool;
        superToken = _superToken;
        host = _host;
        cda = _cda;

        uint256 configWord =
            SuperAppDefinitions.APP_LEVEL_FINAL |
            SuperAppDefinitions.BEFORE_AGREEMENT_CREATED_NOOP |
            SuperAppDefinitions.BEFORE_AGREEMENT_UPDATED_NOOP |
            SuperAppDefinitions.BEFORE_AGREEMENT_TERMINATED_NOOP;

        host.registerApp(configWord);

        IERC20(_superToken.getUnderlyingToken()).approve(address(_superToken), type(uint256).max);
    }

    modifier onlyHost() {
        require(msg.sender == address(host), "ERR_HOST_ONLY");
        _;
    }

    modifier onlyPool() {
        require(msg.sender == address(pool), "ERR_POOL_ONLY");
        _;
    }

    /**
     * @dev Deposits capital into superfluid
     * @param amount - the amount of tokens being deposited
     * @return the amount deposited
     */
    function _invest(uint256 amount, uint256) internal override returns (uint256) {
        superToken.upgrade(amount);
        return amount;
    }

    /**
     * @dev Withdraws capital out of superfluid
     * @param amount - the amount to withdraw
     * @return the number of tokens to return to the vault
     */
    function _divest(uint256 amount, uint256) internal override returns (uint256) {
        superToken.downgrade(amount);
        return amount;
    }

    /**
     * @dev Checks super token balance (fluctuates)
     */
    function _getAUM() internal view override returns (uint256) {
        return superToken.balanceOf(address(this));
    }

    function capitalOut(bytes32 poolId, uint256 amount) external override {}

    function setFlowRate(IPoolSwapStructs.SwapRequest memory swapRequest, bytes memory ctx) external override onlyPool returns (bytes memory) {

        require(address(swapRequest.tokenOut) == address(superToken), "destination token mismatch");

        console.log("set rate out", address(swapRequest.tokenIn), address(swapRequest.tokenOut), swapRequest.amount);

        (ctx, ) = host.callAgreementWithContext(
            cda,
            abi.encodeWithSelector(
                cda.setFlow.selector,
                superToken,
                uint(address(swapRequest.tokenIn)),
                address(pool),
                [uint(address(swapRequest.tokenIn)), uint(address(swapRequest.tokenOut)) + 1],
                swapRequest.to,
                swapRequest.amount, // amount will be modified based on the exchange rate of this 
                new bytes(0) // placeholder
            ),
            "0x",
            ctx
        );

        return ctx;
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
        newCtx = pool.makeStreamTrade(_superToken, _ctx);
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
        newCtx = pool.makeStreamTrade(_superToken, _ctx);
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
        newCtx = pool.makeStreamTrade(_superToken, _ctx);
    }
}