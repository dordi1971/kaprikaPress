// lib/kaprikaContract.ts
import { createWalletClient, http, getContract } from 'viem'
import { polygonAmoy } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'

const privateKey = process.env.ADMIN_PRIVATE_KEY
const rpcUrl = process.env.RPC_URL
const contractAddress = process.env.KAPRIKA_PRESS_ID_ADDRESS

if (!privateKey) throw new Error('ADMIN_PRIVATE_KEY is not set')
if (!rpcUrl) throw new Error('RPC_URL is not set')
if (!contractAddress) throw new Error('KAPRIKA_PRESS_ID_ADDRESS is not set')

// Admin account (owner of the KaprikaPressID contract)
const account = privateKeyToAccount(`0x${privateKey}`)

export const walletClient = createWalletClient({
  account,
  chain: polygonAmoy, // change if you use another chain
  transport: http(rpcUrl),
})

// Minimal ABI for KaprikaPressID – only what we need now
const kaprikaPressIdAbi = [
  {
    type: 'function',
    name: 'mintId',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'tokenURI', type: 'string' },
    ],
    outputs: [{ name: 'tokenId', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'setRevoked',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'value', type: 'bool' },
    ],
    outputs: [],
  },
] as const

export const kaprikaContract = getContract({
  address: contractAddress as `0x${string}`,
  abi: kaprikaPressIdAbi,
  client: walletClient,
})
