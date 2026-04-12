#!/usr/bin/env node
/**
 * 真实的 x402 测试服务端 — 使用 Monad 测试网 Facilitator 完成链上结算
 * 
 * 流程:
 * 1. 客户端请求 → 返回 402 + PaymentRequirements
 * 2. 客户端签名 EIP-712 (ERC-3009 TransferWithAuthorization)
 * 3. 客户端重试请求，附加 PAYMENT-SIGNATURE header
 * 4. 服务端收到后，调用 Facilitator /verify → /settle
 * 5. Facilitator 在 Monad 测试网链上完成 USDC 转账
 * 6. 服务端返回 200 OK + 内容
 *
 * 启动: npx tsx test/x402-test-server-real.ts
 * 端口: 3456
 */
import { createServer } from "node:http";
import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { registerExactEvmScheme } from "@x402/evm/exact/server";
import { encodePaymentRequiredHeader, decodePaymentSignatureHeader } from "@x402/core/http";
import type { PaymentRequired, PaymentRequirements } from "@x402/core/types";

// ── Monad 测试网配置 ──────────────────────────────────────────────────
const CHAIN_ID = 10143;
const MONAD_NETWORK = `eip155:${CHAIN_ID}`;
const USDC_CONTRACT = "0x534b2f3A21130d7a60830c2Df862319e593943A3";
const USDC_DECIMALS = 6;
const FACILITATOR_URL = "https://x402-facilitator.molandak.org";
const PAY_TO = "0xaF292eEdC0e22A2Ed1b5A304AB7073fb8bdF34ED";
const PRICE = "10000"; // 0.01 USDC in smallest units (6 decimals: 0.01 * 10^6 = 10000)
const PRICE_DISPLAY = "0.01"; // human-readable for logs
const PORT = 3456;

// ── 初始化 Facilitator + Resource Server ──────────────────────────────
const facilitator = new HTTPFacilitatorClient({ url: FACILITATOR_URL });
const resourceServer = new x402ResourceServer(facilitator);

// 注册 EVM exact scheme（通配所有 eip155 链）
registerExactEvmScheme(resourceServer, {
  networks: [MONAD_NETWORK as `eip155:${string}`],
});

// ── 构造 PaymentRequirements ──────────────────────────────────────────
function buildPaymentRequirements(url: string): PaymentRequirements {
  return {
    scheme: "exact",
    network: MONAD_NETWORK as `eip155:${string}`,
    asset: USDC_CONTRACT,
    amount: PRICE,
    payTo: PAY_TO,
    maxTimeoutSeconds: 60,
    extra: {
      name: "USD Coin",
      version: "2",
      chainId: CHAIN_ID,
    },
  };
}

function buildPaymentRequired(url: string): PaymentRequired {
  return {
    x402Version: 2,
    resource: {
      url,
      description: "Monad testnet x402 paid endpoint",
    },
    accepts: [buildPaymentRequirements(url)],
  };
}

// ── HTTP 服务器 ────────────────────────────────────────────────────────
const server = createServer(async (req, res) => {
  const url = req.url || "/";

  // 检查是否有 x402 支付签名
  const paymentSignature = req.headers["payment-signature"] || req.headers["x-payment"];

  if (paymentSignature) {
    try {
      // 解码支付签名
      const paymentPayload = decodePaymentSignatureHeader(paymentSignature as string);
      const requirements = buildPaymentRequirements(url);

      console.log("🔍 Verifying payment with Facilitator...");
      console.log(`   Network:  ${MONAD_NETWORK}`);
      console.log(`   Asset:    ${USDC_CONTRACT}`);
      console.log(`   Amount:   ${PRICE} USDC`);
      console.log(`   PayTo:    ${PAY_TO}`);

      // 1. Verify
      const verifyResult = await facilitator.verify(paymentPayload, requirements);
      console.log(`   Verify:   ${JSON.stringify(verifyResult).slice(0, 120)}`);

      if (!(verifyResult as any).valid && !(verifyResult as any).success) {
        res.writeHead(402, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Payment verification failed", detail: verifyResult }));
        return;
      }

      // 2. Settle (链上结算)
      console.log("💰 Settling payment on Monad testnet...");
      const settleResult = await facilitator.settle(paymentPayload, requirements);
      console.log(`   Settle:   ${JSON.stringify(settleResult).slice(0, 160)}`);

      // 3. Success
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        message: "Payment verified and settled on-chain!",
        data: {
          network: `Monad Testnet (${MONAD_NETWORK})`,
          asset: "USDC",
          amount: PRICE,
          payTo: PAY_TO,
          facilitator: FACILITATOR_URL,
          settleResult,
        },
      }));
      console.log(`✅ Payment settled from ${req.socket.remoteAddress}`);
      return;
    } catch (error) {
      console.error("❌ Payment error:", error instanceof Error ? error.message : error);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        error: "Payment processing failed",
        detail: error instanceof Error ? error.message : "Unknown",
      }));
      return;
    }
  }

  // 无支付 — 返回 402
  const paymentRequired = buildPaymentRequired(url);
  const encoded = encodePaymentRequiredHeader(paymentRequired);

  res.writeHead(402, {
    "Content-Type": "application/json",
    "PAYMENT-REQUIRED": encoded,
  });
  res.end(JSON.stringify({
    error: "Payment required",
    x402Version: 2,
    network: MONAD_NETWORK,
    price: `${PRICE_DISPLAY} USDC`,
    payTo: PAY_TO,
  }));
  console.log(`📤 402 sent to ${req.socket.remoteAddress}`);
});

server.listen(PORT, () => {
  console.log("🔒 x402 真实测试服务端已启动（Monad 测试网 Facilitator）");
  console.log(`   URL:          http://localhost:${PORT}/api/paid-content`);
  console.log(`   网络:         ${MONAD_NETWORK} (Monad Testnet)`);
  console.log(`   Facilitator:  ${FACILITATOR_URL}`);
  console.log(`   USDC:         ${USDC_CONTRACT}`);
  console.log(`   收款:         ${PAY_TO}`);
  console.log(`   价格:         ${PRICE} USDC`);
  console.log("");
  console.log("测试:");
  console.log(`   npx tsx src/cli.ts pay --mode x402 --to http://localhost:${PORT}/api/paid-content --amount ${PRICE} --token USDC --reason "x402 monad testnet" --agent test-agent`);
});
