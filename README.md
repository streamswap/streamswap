# Streamswap UI

Web3 application for using streamswap.

Currently the Web UI is only designed to work with Goerli, the only network for which
streamswap is deployed.

## Pages

* `/`: A dashboard which shows live balances, flow rates, and list of open swaps
* `/swap`: Allows for you to create or edit swaps

## Building

This is a Next.js application.

Make sure you have bootstrapped learna in the root. Then run:

```bash
npm run build
npm run export
```

Static files are exported to `dist/`, ready to be uploaded to surge or any other web server.
