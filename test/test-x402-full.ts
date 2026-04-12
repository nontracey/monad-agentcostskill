#!/usr/bin/env node
/**
 * 完整 x402 测试脚本 - 显示每一步的详细过程
 */
import { wrapFetchWithPaymentFromConfig, x402ClientConfig } from "@x402/fetch";
import { ExactEvmScheme, toClientEvmSigner } from "@x402/evm";
import { createPublicClient, http, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const SESSION_KEY = "0xbe49a12d96d2592b76183dedf77c2b1fe09f83ef479cfe78c25fa655e929f359";
const RPC_URL = "https://testnet-rpc.monad.xyz/";
const CHAIN_ID = 10143;
const USDC_CONTRACT = "0x534b2f3A21130d7a60830c2Df862319e593943A3";
const SERVER_URL = "http://localhost:3456/api/paid-content";

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testX402() {
  // 禁用代理，确保本地连接不走代理
  delete process.env.HTTP_PROXY;
  delete process.env.http_proxy;
  delete process.env.HTTPS_PROXY;
  delete process.env.https_proxy;

  console.log("=".repeat(60));
  console.log("🧪 x402 完整测试流程");
  console.log("=".repeat(60));
  console.log("");

  // 1. 初始化账户
  const account = privateKeyToAccount(SESSION_KEY as `0x${string}`);
  console.log("📍 签名地址:", account.address);
  console.log("");

  // 2. 检查 USDC 余额
  const publicClient = createPublicClient({
    transport: http(RPC_URL),
    chain: {
      id: CHAIN_ID,
      name: "Monad",
      nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
      rpcUrls: { default: { http: [RPC_URL] } },
    } as any,
  });

  const usdcBalance = await publicClient.readContract({
    address: USDC_CONTRACT,
    abi: [{
      name: "balanceOf",
      type: "function",
      stateMutability: "view",
      inputs: [{ name: "account", type: "address" }],
      outputs: [{ name: "balance", type: "uint256" }],
    }],
    functionName: "balanceOf",
    args: [account.address],
  });

  const balanceNum = Number(formatUnits(usdcBalance as bigint, 6));
  console.log("💵 USDC 余额:", balanceNum);
  if (balanceNum < 0.01) {
    console.log("❌ 余额不足，退出");
    return;
  }
  console.log("");

  // 3. 创建 signer
  console.log("🔑 创建 EVM Signer...");
  const signer = toClientEvmSigner({
    address: account.address,
    signTypedData: async (msg) => account.signTypedData(msg as any),
  }, {
    readContract: publicClient.readContract.bind(publicClient),
    getTransactionCount: async ({ address }) => 
      Number(await publicClient.getTransactionCount({ address })),
    estimateFeesPerGas: () => publicClient.estimateFeesPerGas(),
  });

  const x402Config: x402ClientConfig = {
    schemes: [{
      network: `eip155:${CHAIN_ID}` as `eip155:${string}`,
      client: new ExactEvmScheme(signer),
    }],
  };

  const fetchWithPay = wrapFetchWithPaymentFromConfig(
    globalThis.fetch.bind(globalThis),
    x402Config,
  );

  console.log("✅ Signer 创建成功");
  console.log("");

  // 4. 发起请求
  console.log("🌐 发起 x402 支付请求...");
  console.log("   URL:", SERVER_URL);
  console.log("");

  try {
    console.log("⏳ 等待响应...");
    const resp = await fetchWithPay(SERVER_URL);
    
    console.log("📥 收到响应:");
    console.log("   状态码:", resp.status);
    console.log("   状态文本:", resp.statusText);
    console.log("");

    const body = await resp.text();
    console.log("📦 响应体:");
    try {
      const json = JSON.parse(body);
      console.log(JSON.stringify(json, null, 2));
    } catch {
      console.log(body);
    }

    console.log("");
    if (resp.ok) {
      console.log("🎉 x402 支付成功！");
    } else {
      console.log("⚠️  请求失败");
    }
  } catch (error: any) {
    console.log("❌ 错误:");
    console.log("   消息:", error.message);
    if (error.cause) {
      console.log("   原因:", error.cause.message || error.cause);
    }
    console.log("");
    console.log("📚 完整堆栈:");
    console.log(error.stack);
  }
}

testX402().catch(console.error);
