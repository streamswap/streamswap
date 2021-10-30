pragma abicoder v2;

import "@balancer-labs/v2-vault/contracts/interfaces/IPoolSwapStructs.sol";

interface IStreamswapAssetManager {

    /**
     * Instructs the asset manager to set an outgoing flow matching the parameters specified in `swapRequest`
     */
    function setFlowRate(IPoolSwapStructs.SwapRequest memory swapRequest, bytes memory ctx) external returns (bytes memory);
}