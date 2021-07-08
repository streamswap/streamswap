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

pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../balancer-v2-monorepo/pkg/vault/contracts/interfaces/IVault.sol";

import "../balancer-v2-monorepo/pkg/pool-utils/contracts/factories/BasePoolSplitCodeFactory.sol";
import "../balancer-v2-monorepo/pkg/pool-utils/contracts/factories/FactoryWidePauseWindow.sol";

import "./WeightedPool.sol";

contract StreamSwapPoolFactory is BasePoolSplitCodeFactory, FactoryWidePauseWindow {
    constructor(IVault vault) BasePoolSplitCodeFactory(vault, type(WeightedPool).creationCode) {
        // solhint-disable-previous-line no-empty-blocks
    }

    /**
     * @dev Deploys a new `WeightedPool`.
     */
    function create(
        ISuperfluid host,
        IConstantFlowAgreement cfa,

        string memory name,
        string memory symbol,
        ISuperToken[] memory superTokens,
        uint256[] memory weights,
        address[] memory assetManagers,
        uint256 swapFeePercentage,
        address owner
    ) external returns (address) {
        (uint256 pauseWindowDuration, uint256 bufferPeriodDuration) = getPauseConfiguration();

        // construct asset managers for each super token
        address[] memory assetManagers = new address[]
        IERC20[] memory tokens = new IERC20[](superTokens.length);

        for (uint i = 0;i < superTokens.length;i++) {
            assetManagers[i] = address(new StreamSwapAssetManager(
                vault,
                pool,
                host,
                cfa,
                superTokens[i]
            ));
            tokens[i] = superTokens[i].getUnderlyingToken();
        }

        return
            _create(
                abi.encode(
                    getVault(),
                    host,
                    cfa
                    name,
                    symbol,
                    tokens,
                    weights,
                    assetManagers,
                    swapFeePercentage,
                    pauseWindowDuration,
                    bufferPeriodDuration,
                    owner
                )
            );
    }
}
