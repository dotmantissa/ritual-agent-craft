import { encodeFunctionData, keccak256, toHex } from "viem";

export const SOVEREIGN_FACTORY = "0x9dC4C054e53bCc4Ce0A0Ff09E890A7a8e817f304" as const;
export const RITUAL_CHAIN_ID = 1979;
export const RITUAL_EXPLORER = "https://explorer.ritualfoundation.org";

const deployHarnessAbi = [
  {
    name: "deployHarness",
    type: "function" as const,
    stateMutability: "nonpayable" as const,
    inputs: [{ name: "userSalt", type: "bytes32" }],
    outputs: [{ name: "harness", type: "address" }],
  },
] as const;

// Deterministic bytes32 salt derived from the agent's DB UUID
export function agentUserSalt(agentId: string): `0x${string}` {
  return keccak256(toHex(agentId));
}

// Encodes the calldata for SovereignAgentFactory.deployHarness(bytes32)
export function encodeDeployHarness(agentId: string): `0x${string}` {
  return encodeFunctionData({
    abi: deployHarnessAbi,
    functionName: "deployHarness",
    args: [agentUserSalt(agentId)],
  });
}
