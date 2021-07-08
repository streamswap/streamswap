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
    IConstantFlowAgreementV1
} from "@superfluid-finance/ethereum-contracts/contracts/interfaces/agreements/IConstantFlowAgreementV1.sol";

import "./RewardsAssetManager.sol";

import { StreamSwapPool } from "./StreamSwapPool.sol";

import "hardhat/console.sol";

pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

contract StreamSwapAssetManager is RewardsAssetManager, SuperAppBase {
    uint16 public constant REFERRAL_CODE = 0;

    StreamSwapPool pool;
    ISuperToken public superToken;

    ISuperfluid public host;
    IConstantFlowAgreementV1 public cfa;

    constructor(
        IVault _vault,
        StreamSwapPool _pool,
        ISuperfluid _host,
        IConstantFlowAgreementV1 _cfa,
        ISuperToken _superToken
    ) RewardsAssetManager(_vault, _pool.poolId, _superToken.getUnderlyingToken()) {
        //super;
        pool = _pool;
        superToken = _superToken;
        host = _host;
        cfa = _cfa;

        uint256 configWord =
            SuperAppDefinitions.APP_LEVEL_FINAL |
            SuperAppDefinitions.BEFORE_AGREEMENT_CREATED_NOOP |
            SuperAppDefinitions.BEFORE_AGREEMENT_UPDATED_NOOP |
            SuperAppDefinitions.BEFORE_AGREEMENT_TERMINATED_NOOP;

        host.registerApp(configWord);

        _superToken.getUnderlyingToken().approve(address(_superToken), type(uint256).max);
    }

    modifier onlyHost() {
        require(msg.sender == address(host), "ERR_HOST_ONLY");
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

    function setFlowWithContext(bytes memory newSfCtx, address to, uint oldOutRate, uint newOutRate) public returns (bytes memory) {
        if (oldOutRate != newOutRate) {
            (,int96 curOutFlow,,) = cfa.getFlow(ISuperToken(superToken), address(this), to);

            console.log("with context adjust trade out", uint(curOutFlow), oldOutRate, newOutRate);
            if (curOutFlow == oldOutRate && newOutRate == 0) {
                (newSfCtx, ) = host.callAgreementWithContext(
                    cfa,
                    abi.encodeWithSelector(
                        cfa.deleteFlow.selector,
                        superToken,
                        address(this), // for some reason deleteFlow is the only function that takes a sender parameter
                        to,
                        new bytes(0) // placeholder
                    ),
                    "0x",
                    newSfCtx
                );
            }
            else {
                (newSfCtx, ) = host.callAgreementWithContext(
                    cfa,
                    abi.encodeWithSelector(
                        curOutFlow == 0 ? cfa.createFlow.selector : cfa.updateFlow.selector,
                        superToken,
                        to,
                        uint256(curOutFlow) + newOutRate - oldOutRate,
                        new bytes(0) // placeholder
                    ),
                    "0x",
                    newSfCtx
                );
            }
        }

        return newSfCtx;
    }

    function setFlow(address to, uint oldOutRate, uint newOutRate) public {
        if (oldOutRate != newOutRate) {
            (,int96 curOutFlow,,) = cfa.getFlow(ISuperToken(superToken), address(this), to);

            console.log("no context adjust trade out", uint(curOutFlow), newOutRate, oldOutRate);

            if (curOutFlow == oldOutRate && newOutRate == 0) {
                host.callAgreement(
                    cfa,
                    abi.encodeWithSelector(
                        cfa.deleteFlow.selector,
                        superToken,
                        address(this), // for some reason deleteFlow is the only function that takes a sender parameter
                        to,
                        new bytes(0) // placeholder
                    ),
                    "0x"
                );
            }
            else {
                host.callAgreement(
                    cfa,
                    abi.encodeWithSelector(
                        curOutFlow == 0 ? cfa.createFlow.selector : cfa.updateFlow.selector,
                        superToken,
                        to,
                        uint256(curOutFlow) + newOutRate - oldOutRate,
                        new bytes(0) // placeholder
                    ),
                    "0x"
                );
            }
        }
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
        newCtx = pool.makeTrade(_superToken, _ctx);
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
        newCtx = pool.makeTrade(_superToken, _ctx);
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
        newCtx = pool.makeTrade(_superToken, _ctx);
    }
}