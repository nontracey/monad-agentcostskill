import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { generatePrivateKey, privateKeyToAccount, type Account } from "viem/accounts";
import { createPublicClient, createWalletClient, http, type Chain } from "viem";
import type { SessionKey } from "./types.js";

function makeChain(rpcUrl: string, chainId: number): Chain {
  return {
    id: chainId,
    name: "Monad",
    nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  } as Chain;
}

export function generateSessionKey(): SessionKey {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  return {
    privateKey,
    address: account.address,
  };
}

export function loadSessionKey(sessionPath: string): Account | null {
  try {
    if (!existsSync(sessionPath)) return null;
    const raw = readFileSync(sessionPath, "utf-8");
    const key = JSON.parse(raw) as SessionKey;
    return privateKeyToAccount(key.privateKey as `0x${string}`);
  } catch {
    return null;
  }
}

export function saveSessionKey(sessionPath: string, key: SessionKey): void {
  writeFileSync(sessionPath, JSON.stringify(key, null, 2) + "\n", "utf-8");
}

export function loadSessionKeyInfo(sessionPath: string): SessionKey | null {
  try {
    if (!existsSync(sessionPath)) return null;
    const raw = readFileSync(sessionPath, "utf-8");
    return JSON.parse(raw) as SessionKey;
  } catch {
    return null;
  }
}

export async function revokeSessionKey(
  sessionPath: string,
  mainAddress: string,
  rpcUrl: string,
  chainId: number,
): Promise<{ drained: boolean; txHash?: string; newKey: SessionKey }> {
  const account = loadSessionKey(sessionPath);
  let drained = false;
  let txHash: string | undefined;

  if (account) {
    // Check balance and drain to main wallet
    const chain = makeChain(rpcUrl, chainId);
    const publicClient = createPublicClient({
      transport: http(rpcUrl),
      chain,
    });
    const balance = await publicClient.getBalance({ address: account.address });

    if (balance > 0n) {
      const walletClient = createWalletClient({
        account,
        transport: http(rpcUrl),
        chain,
      });
      // Send all balance back to main wallet (leave a tiny bit for gas)
      const gasEstimate = 21000n;
      // We'll estimate gas price roughly; for testnet this is fine
      const gasPrice = await publicClient.getGasPrice();
      const gasCost = gasEstimate * gasPrice;
      const sendAmount = balance > gasCost ? balance - gasCost : 0n;

      if (sendAmount > 0n) {
        txHash = await walletClient.sendTransaction({
          chain: null,
          to: mainAddress as `0x${string}`,
          value: sendAmount,
        });
        drained = true;
      }
    }
  }

  // Generate new session key and save
  const newKey = generateSessionKey();
  saveSessionKey(sessionPath, newKey);

  return { drained, txHash, newKey };
}
