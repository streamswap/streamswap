import { ISuperToken } from "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperToken.sol";

interface IStreamswapPool {

    function poolId() external returns (bytes32);

    function makeTrade(ISuperToken superToken, bytes calldata ctx) external returns (bytes memory);
}