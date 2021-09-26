pragma abicoder v2;

import "@balancer-labs/v2-vault/contracts/interfaces/IPoolSwapStructs.sol";

interface IStreamswapAssetManager {
    function setFlowRate(IPoolSwapStructs.SwapRequest memory swapRequest, bytes memory ctx) external returns (bytes memory);
}