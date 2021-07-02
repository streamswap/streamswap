// SPDX-License-Identifier: GPL-3.0

// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is disstributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

pragma solidity 0.7.6;

// Builds new StreamSwapPools, logging their addresses and providing `isBPool(address) -> (bool)`

import "./StreamSwapPool.sol";

contract StreamSwapFactory is BBronze {
    event LOG_NEW_POOL(
        address indexed caller,
        address indexed pool
    );

    event LOG_BLABS(
        address indexed caller,
        address indexed blabs
    );

    StreamSwapFactoryHelper private immutable _helper;
    ISuperfluid public immutable _host;
    IConstantFlowAgreementV1 public immutable _cfa;

    mapping(address=>bool) private _isBPool;

    function isBPool(address b)
        external view returns (bool)
    {
        return _isBPool[b];
    }

    function newBPool()
        external
        returns (StreamSwapPool)
    {
        StreamSwapPool bpool = _helper.create(_host, _cfa);
        _isBPool[address(bpool)] = true;
        emit LOG_NEW_POOL(msg.sender, address(bpool));
        bpool.setController(msg.sender);
        return bpool;
    }

    address private _blabs;

    constructor(StreamSwapFactoryHelper helper, ISuperfluid host, IConstantFlowAgreementV1 cfa) public {
        require(ISuperfluid(host).isAgreementClassListed(IConstantFlowAgreementV1(cfa)), 
            "ERR_BAD_SUPERFLUID");
        require(IConstantFlowAgreementV1(cfa).agreementType() == 
            keccak256("org.superfluid-finance.agreements.ConstantFlowAgreement.v1"), "ERR_BAD_CFA");

        _blabs = msg.sender;
        _helper = helper;
        _host = host;
        _cfa = cfa;
    }

    function getBLabs()
        external view
        returns (address)
    {
        return _blabs;
    }

    function setBLabs(address b)
        external
    {
        require(msg.sender == _blabs, "ERR_NOT_BLABS");
        emit LOG_BLABS(msg.sender, b);
        _blabs = b;
    }

    function collect(StreamSwapPool pool)
        external 
    {
        require(msg.sender == _blabs, "ERR_NOT_BLABS");
        uint collected = IERC20(pool).balanceOf(address(this));
        bool xfer = pool.transfer(_blabs, collected);
        require(xfer, "ERR_ERC20_FAILED");
    }
}

// spliting this off because the contract is getting bigger
contract StreamSwapFactoryHelper {
    function create(ISuperfluid host, IConstantFlowAgreementV1 cfa)
        external
        returns (StreamSwapPool)
    {
        StreamSwapPool bpool = new StreamSwapPool(host, cfa);
        bpool.setController(msg.sender);
        return bpool;
    }
}
