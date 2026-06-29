import { createPublicClient, http, encodeFunctionData, keccak256, toHex } from "viem";
import { defineChain } from "viem";

export const SOVEREIGN_FACTORY = "0x9dC4C054e53bCc4Ce0A0Ff09E890A7a8e817f304" as const;
export const RITUAL_CHAIN_ID = 1979;
export const RITUAL_EXPLORER = "https://explorer.ritualfoundation.org";
export const RITUAL_RPC = "https://rpc.ritualfoundation.org";

export const ritualTestnet = defineChain({
  id: 1979,
  name: "Ritual Testnet",
  nativeCurrency: { name: "Ritual", symbol: "RITUAL", decimals: 18 },
  rpcUrls: { default: { http: [RITUAL_RPC] } },
  blockExplorers: { default: { name: "Ritual Explorer", url: RITUAL_EXPLORER } },
  testnet: true,
});

export const publicClient = createPublicClient({
  chain: ritualTestnet,
  transport: http(RITUAL_RPC),
});

const deployHarnessAbi = [
  {
    name: "deployHarness",
    type: "function" as const,
    stateMutability: "nonpayable" as const,
    inputs: [{ name: "userSalt", type: "bytes32" }],
    outputs: [{ name: "harness", type: "address" }],
  },
] as const;

const predictHarnessAbi = [
  {
    name: "predictHarness",
    type: "function" as const,
    stateMutability: "view" as const,
    inputs: [
      { name: "owner", type: "address" },
      { name: "userSalt", type: "bytes32" },
    ],
    outputs: [
      { name: "harness", type: "address" },
      { name: "childSalt", type: "bytes32" },
    ],
  },
] as const;

export const sovereignHarnessAbi = [
  {
    name: "configured",
    type: "function" as const,
    stateMutability: "view" as const,
    inputs: [],
    outputs: [{ type: "bool" }],
  },
  {
    name: "owner",
    type: "function" as const,
    stateMutability: "view" as const,
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    name: "stop",
    type: "function" as const,
    stateMutability: "nonpayable" as const,
    inputs: [],
    outputs: [],
  },
  {
    name: "restart",
    type: "function" as const,
    stateMutability: "nonpayable" as const,
    inputs: [],
    outputs: [],
  },
] as const;

export function agentUserSalt(agentId: string): `0x${string}` {
  return keccak256(toHex(agentId));
}

export function encodeDeployHarness(agentId: string): `0x${string}` {
  return encodeFunctionData({
    abi: deployHarnessAbi,
    functionName: "deployHarness",
    args: [agentUserSalt(agentId)],
  });
}

export function encodeStop(): `0x${string}` {
  return encodeFunctionData({ abi: sovereignHarnessAbi, functionName: "stop", args: [] });
}

export function encodeRestart(): `0x${string}` {
  return encodeFunctionData({ abi: sovereignHarnessAbi, functionName: "restart", args: [] });
}

export async function predictHarness(
  ownerAddress: `0x${string}`,
  agentId: string,
): Promise<`0x${string}`> {
  const salt = agentUserSalt(agentId);
  const [harness] = await publicClient.readContract({
    address: SOVEREIGN_FACTORY,
    abi: predictHarnessAbi,
    functionName: "predictHarness",
    args: [ownerAddress, salt],
  }) as [`0x${string}`, `0x${string}`];
  return harness;
}

export async function getHarnessBalance(harnessAddress: `0x${string}`): Promise<bigint> {
  return publicClient.getBalance({ address: harnessAddress });
}

export async function getHarnessConfigured(harnessAddress: `0x${string}`): Promise<boolean> {
  try {
    const result = await publicClient.readContract({
      address: harnessAddress,
      abi: sovereignHarnessAbi,
      functionName: "configured",
    });
    return result as boolean;
  } catch {
    return false;
  }
}
