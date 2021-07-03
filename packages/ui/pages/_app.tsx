import { ethers } from 'ethers';

import '../styles/globals.css'
import type { AppProps } from 'next/app'
import React from 'react'

import { Web3ReactProvider } from '@web3-react/core'

function MyApp({ Component, pageProps }: AppProps) {

  function getLibrary(provider: any): ethers.providers.Web3Provider {
    return new ethers.providers.Web3Provider(provider);
  }

  return (
    <Web3ReactProvider getLibrary={getLibrary}>
      <Component {...pageProps} />
    </Web3ReactProvider>
  )
}
export default MyApp
