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
const FACILITATOR_URL = process.env.FACILITATOR_URL || "https://x402-facilitator.molandak.org";
// 收款地址（资源服务器所有者的地址，不能是付款人地址）
const PAY_TO =
  process.env.PAY_TO || "0x1234567890123456789012345678901234567890";
const PRICE = "10000"; // 0.01 USDC in smallest units (6 decimals: 0.01 * 10^6 = 10000)
const PRICE_DISPLAY = "0.01"; // human-readable for logs
const PRICE_HUMAN = "0.01"; // amount for CLI --arg (human readable)
const PORT = Number(process.env.PORT || 3456);

// ── 初始化 Facilitator + Resource Server ──────────────────────────────
const facilitator = new HTTPFacilitatorClient({ url: FACILITATOR_URL });
const resourceServer = new x402ResourceServer(facilitator);

// 注册 EVM exact scheme（通配所有 eip155 链）
registerExactEvmScheme(resourceServer, {
  networks: [MONAD_NETWORK as `eip155:${string}`],
});

await resourceServer.initialize();

function safeJson(value: unknown): string {
  return JSON.stringify(
    value,
    (_, currentValue) =>
      typeof currentValue === "bigint"
        ? currentValue.toString()
        : currentValue,
    2,
  );
}

function sendJson(
  res: Parameters<typeof createServer>[0] extends (req: any, res: infer Res) => any
    ? Res
    : never,
  statusCode: number,
  body: unknown,
): void {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(safeJson(body));
}

function getAbsoluteUrl(req: Parameters<typeof createServer>[0] extends (
  req: infer Req,
  ...args: any[]
) => any
  ? Req
  : never): string {
  const host = req.headers.host || `localhost:${PORT}`;
  const path = req.url || "/";
  return `http://${host}${path}`;
}

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
      name: "USDC",
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
  const url = getAbsoluteUrl(req);

  // 检查是否有 x402 支付签名
  const paymentSignature = req.headers["payment-signature"] || req.headers["x-payment"];

  if (paymentSignature) {
    let paymentPayload: any;
    let requirements: any;
    try {
      // 解码支付签名
      paymentPayload = decodePaymentSignatureHeader(paymentSignature as string);
      // 注意：直接使用完整的 paymentPayload，不要提取 payload.payload
      // paymentPayload 结构: { x402Version, payload, resource, accepted }
      requirements = paymentPayload?.accepted ?? buildPaymentRequirements(url);

      console.log("📥 收到支付签名:");
      console.log("   Payment payload keys:", Object.keys(paymentPayload || {}));
      console.log("   x402Version:", paymentPayload?.x402Version);
      console.log("   Requirements:", safeJson(requirements).slice(0, 300));

      console.log("🔍 Verifying payment with Facilitator...");
      console.log(`   Network:  ${MONAD_NETWORK}`);
      console.log(`   Asset:    ${USDC_CONTRACT}`);
      console.log(`   Amount:   ${PRICE} USDC`);
      console.log(`   PayTo:    ${PAY_TO}`);

      // 1. Verify - 直接传递完整的 paymentPayload（包含 x402Version）
      const verifyResult = await facilitator.verify(paymentPayload, requirements);
      console.log(`   Verify:   ${safeJson(verifyResult).slice(0, 120)}`);

      if (!(verifyResult as any).isValid) {
        sendJson(res, 402, {
          error: "Payment verification failed",
          detail: verifyResult,
        });
        return;
      }

      // 2. Settle (链上结算)
      console.log("💰 Settling payment on Monad testnet...");
      const settleResult = await facilitator.settle(paymentPayload, requirements);
      // 单独打印完整交易哈希
      const settleAny = settleResult as any;
      const txHash = settleAny?.transaction?.hash || settleAny?.transaction || settleAny?.txHash || "N/A";
      // 用 JSON 格式输出，避免被截断
      process.stderr.write("TX_HASH_START" + txHash + "TX_HASH_END\n");
      console.log("   ✅ 交易哈希:", txHash.slice(0, 20) + "..." + txHash.slice(-20));
      console.log(`   Settle:   ${safeJson(settleResult).slice(0, 160)}`);

      // 3. Success
      sendJson(res, 200, {
        message: "Payment verified and settled on-chain!",
        data: {
          network: `Monad Testnet (${MONAD_NETWORK})`,
          asset: "USDC",
          amount: PRICE,
          payTo: PAY_TO,
          facilitator: FACILITATOR_URL,
          settleResult,
        },
      });
      console.log(`✅ Payment settled from ${req.socket.remoteAddress}`);
      return;
    } catch (error) {
      const statusCode =
        typeof (error as { statusCode?: unknown })?.statusCode === "number"
          ? Number((error as { statusCode: number }).statusCode)
          : 500;
      const invalidReason =
        typeof (error as { invalidReason?: unknown })?.invalidReason === "string"
          ? String((error as { invalidReason: string }).invalidReason)
          : undefined;

      console.error("❌ Payment error:", error instanceof Error ? error.message : error);
      console.error("   Full error:", safeJson(error));
      if (error instanceof Error) {
        console.error("   Stack:", error.stack);
      }
      console.error("   Payment payload keys:", Object.keys(paymentPayload || {}));
      console.error("   Requirements:", safeJson(requirements));
      sendJson(res, statusCode, {
          error: statusCode >= 500 ? "Payment processing failed" : "Payment verification failed",
          detail: error instanceof Error ? error.message : "Unknown",
          invalidReason,
          paymentPayloadKeys: Object.keys(paymentPayload || {}),
          requirements,
        });
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
  res.end(safeJson({
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
  console.log(`   价格:         ${PRICE_DISPLAY} USDC`);
  console.log("");
  console.log("测试:");
  console.log(`   npx tsx src/cli.ts pay --mode x402 --to http://localhost:${PORT}/api/paid-content --amount ${PRICE_HUMAN} --token USDC --reason "x402 monad testnet" --agent test-agent`);
});
