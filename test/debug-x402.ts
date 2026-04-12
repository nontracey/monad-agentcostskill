#!/usr/bin/env node
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme, toClientEvmSigner } from "@x402/evm";
import { createPublicClient, http } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

// 使用已有的 session key（有 USDC 余额）
const account = privateKeyToAccount("0xbe49a12d96d2592b76183dedf77c2b1fe09f83ef479cfe78c25fa655e929f359" as `0x${string}`);
console.log("Signer:", account.address);
console.log("");
console.log("ℹ️  使用已有 Session Key（有 Monad 测试网 USDC 余额）");
console.log("");

const publicClient = createPublicClient({
  transport: http("https://testnet-rpc.monad.xyz/"),
  chain: {
    id: 10143,
    name: "Monad",
    nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
    rpcUrls: { default: { http: ["https://testnet-rpc.monad.xyz/"] } },
  } as any,
});

const signer = toClientEvmSigner({
  address: account.address,
  signTypedData: async (msg) => account.signTypedData(msg as any),
}, {
  readContract: publicClient.readContract.bind(publicClient),
  getTransactionCount: async ({ address }) => Number(await publicClient.getTransactionCount({ address })),
  estimateFeesPerGas: () => publicClient.estimateFeesPerGas(),
});

const x402Config = {
  schemes: [{
    network: "eip155:10143" as `eip155:${string}`,
    client: new ExactEvmScheme(signer),
  }],
};

const fetchWithPay = wrapFetchWithPaymentFromConfig(fetch, x402Config);

try {
  console.log("Fetching http://localhost:3456/api/paid-content ...");
  const resp = await fetchWithPay("http://localhost:3456/api/paid-content");
  console.log("✅ Status:", resp.status);
  console.log("📦 Body:", await resp.text());
} catch (e: any) {
  console.error("❌ Error:", e.message);
  if (e.cause) console.error("   Cause:", e.cause.message || e.cause);
  // Print full stack for debugging
  console.error("   Stack:", e.stack);
}
