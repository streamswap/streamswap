
//SPDX-License-Identifier: MIT
pragma solidity >=0.7.6;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * Basic token only for testing that sends all tokens to creator
 */
contract TestToken is ERC20 {
    constructor(string memory name, string memory symbol, uint256 initialBalance) public
        ERC20(name, symbol)
    {
        _mint(msg.sender, initialBalance);
    }
}