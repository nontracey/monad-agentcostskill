#!/usr/bin/env node
/**
 * 极简 x402 测试，打印每一步
 */
delete process.env.HTTP_PROXY;
delete process.env.http_proxy;
delete process.env.HTTPS_PROXY;
delete process.env.https_proxy;

import { wrapFetchWithPaymentFromConfig, x402ClientConfig } from "@x402/fetch";
import { ExactEvmScheme, toClientEvmSigner } from "@x402/evm";
import { createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const SESSION_KEY = "0xbe49a12d96d2592b76183dedf77c2b1fe09f83ef479cfe78c25fa655e929f359";
const RPC_URL = "https://testnet-rpc.monad.xyz/";
const CHAIN_ID = 10143;
const URL = "http://localhost:3456/api/paid-content";

const account = privateKeyToAccount(SESSION_KEY as `0x${string}`);
console.log("📍 地址:", account.address);

const publicClient = createPublicClient({
  transport: http(RPC_URL),
  chain: { id: CHAIN_ID, name: "Monad", nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 }, rpcUrls: { default: { http: [RPC_URL] } } } as any,
});

const signer = toClientEvmSigner({
  address: account.address,
  signTypedData: async (msg) => account.signTypedData(msg as any),
}, {
  readContract: publicClient.readContract.bind(publicClient),
  getTransactionCount: async ({ address }) => Number(await publicClient.getTransactionCount({ address })),
  estimateFeesPerGas: () => publicClient.estimateFeesPerGas(),
});

const x402Config: x402ClientConfig = {
  schemes: [{ x402Version: 2, network: `eip155:${CHAIN_ID}` as `eip155:${string}`, client: new ExactEvmScheme(signer) }],
};

const fetchWithPay = wrapFetchWithPaymentFromConfig(globalThis.fetch.bind(globalThis), x402Config);

console.log("🌐 请求:", URL);
console.log("⏳ 等待响应...\n");

try {
  const resp = await fetchWithPay(URL);
  console.log("📥 状态:", resp.status, resp.statusText);
  const body = await resp.text();
  console.log("📦 响应:", body.slice(0, 500));
  console.log(resp.ok ? "\n✅ 成功" : "\n❌ 失败");
} catch (e: any) {
  console.error("❌ 异常:", e.message);
  console.error("   Cause:", e.cause?.message || e.cause);
  if (e.cause?.errors) {
    console.error("   Errors:", JSON.stringify(e.cause.errors, null, 2));
  }
}
