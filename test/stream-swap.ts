import 'mocha';

import { deployments } from 'hardhat';

describe("Greeter", function() {
  it("Should return the new greeting once it's changed", async function() {
    await deployments.fixture(['EthDaiPool']);
  });
});