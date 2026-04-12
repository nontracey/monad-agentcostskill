import { createPublicClient, http, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const RPC = "https://testnet-rpc.monad.xyz/";
const USDC = "0x534b2f3A21130d7a60830c2Df862319e593943A3";
const TX_HASH = "0xff740ccf5be5d514a73a736a1ac05e176a0f4b5ebf5e9cfb2a83f83ee2247873";
const SESSION_KEY = "0xbe49a12d96d2592b76183dedf77c2b1fe09f83ef479cfe78c25fa655e929f359";

const account = privateKeyToAccount(SESSION_KEY as `0x${string}`);

const client = createPublicClient({
  transport: http(RPC),
  chain: { id: 10143, name: "Monad", nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 }, rpcUrls: { default: { http: [RPC] } } } as any,
});

const erc20Abi = [
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
  { name: "name", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { name: "symbol", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
];

async function main() {
  console.log("🔗 交易哈希:", TX_HASH);
  console.log("📍 地址:", account.address);
  console.log("");

  // 查询交易收据
  try {
    const receipt = await client.getTransactionReceipt({ hash: TX_HASH as `0x${string}` });
    console.log("📋 交易状态:", receipt.status === "success" ? "✅ 成功" : "❌ 失败");
    console.log("📍 区块号:", receipt.blockNumber);
    console.log("⛽ Gas 使用:", receipt.gasUsed.toString());
    console.log("");
  } catch (e: any) {
    console.log("⚠️  交易查询:", e.shortMessage || e.message);
    console.log("");
  }

  // 查询 USDC 信息
  const name = await client.readContract({ address: USDC, abi: erc20Abi, functionName: "name" });
  const symbol = await client.readContract({ address: USDC, abi: erc20Abi, functionName: "symbol" });
  console.log(`💵 Token: ${name} (${symbol})`);
  console.log("");

  // 查询余额
  const bal = await client.readContract({ address: USDC, abi: erc20Abi, functionName: "balanceOf", args: [account.address] });
  const monBal = await client.getBalance({ address: account.address });

  console.log("📊 当前余额:");
  console.log(`   USDC: ${formatUnits(bal as bigint, 6)}`);
  console.log(`   MON:  ${formatUnits(monBal, 18)}`);
  console.log("");
  console.log("🌐 浏览器链接:");
  console.log(`   https://testnet.monadexplorer.com/tx/${TX_HASH}`);
  console.log(`   https://testnet.monadscan.com/tx/${TX_HASH}`);
}

main().catch(console.error);
