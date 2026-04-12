#!/usr/bin/env node
/**
 * 检查 Session Key 的 USDC 余额
 */
import { createPublicClient, http, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const CHAIN_ID = 10143;
const RPC_URL = "https://testnet-rpc.monad.xyz/";
const USDC_CONTRACT = "0x534b2f3A21130d7a60830c2Df862319e593943A3";
const SESSION_KEY = "0xbe49a12d96d2592b76183dedf77c2b1fe09f83ef479cfe78c25fa655e929f359";

const account = privateKeyToAccount(SESSION_KEY as `0x${string}`);

const publicClient = createPublicClient({
  transport: http(RPC_URL),
  chain: {
    id: CHAIN_ID,
    name: "Monad",
    nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
    rpcUrls: { default: { http: [RPC_URL] } },
  } as any,
});

async function checkBalances() {
  console.log("📍 Session Key 地址:", account.address);
  console.log("");

  // MON 余额
  const monBalance = await publicClient.getBalance({ address: account.address });
  console.log("💰 MON 余额:", formatUnits(monBalance, 18));
  console.log("");

  // USDC 余额 (ERC-20 balanceOf)
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

  console.log("💵 USDC 余额:", formatUnits(usdcBalance as bigint, 6));
  console.log("   (需要至少 0.01 USDC 用于 x402 测试)");
  console.log("");

  if (Number(formatUnits(usdcBalance as bigint, 6)) < 0.01) {
    console.log("⚠️  USDC 余额不足！请从水龙头或你的钱包转入 USDC 到此地址");
    console.log("   USDC 合约:", USDC_CONTRACT);
  } else {
    console.log("✅ USDC 余额充足，可以进行 x402 测试");
  }
}

checkBalances().catch(console.error);
