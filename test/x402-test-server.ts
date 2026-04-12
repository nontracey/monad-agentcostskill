#!/usr/bin/env node
/**
 * x402 测试服务端 — 返回 402 + 正确的 payment required header
 * 
 * 启动: npx tsx test/x402-test-server.ts
 * 端口: 3456
 */
import { createServer } from "node:http";
import { encodePaymentRequiredHeader, encodePaymentResponseHeader } from "@x402/core/http";
import type { PaymentRequired, PaymentPayload, SettleResponse } from "@x402/core/types";

const PORT = 3456;
const CHAIN_ID = 10143; // Monad testnet
// 使用一个测试收款地址（session key 本身也可以，这里用固定地址）
const PAY_TO = "0x0000000000000000000000000000000000000001";
const AMOUNT = "1"; // 1 USDC unit (depends on decimals)
const ASSET = "USDC";

const USDC_ADDRESS = "0x0000000000000000000000000000000000000002"; // dummy for test

const paymentRequired: PaymentRequired = {
  x402Version: 2,
  resource: {
    url: `http://localhost:${PORT}/api/paid-content`,
    description: "Paid API endpoint for x402 testing",
  },
  accepts: [
    {
      scheme: "exact",
      network: `eip155:${CHAIN_ID}`,
      asset: USDC_ADDRESS,
      amount: AMOUNT,
      payTo: PAY_TO,
      maxTimeoutSeconds: 60,
      extra: {
        name: "USD Coin",
        version: "2",
        chainId: CHAIN_ID,
      },
    },
  ],
};

const server = createServer(async (req, res) => {
  const url = req.url || "/";

  // Check for x402 payment header (client sends PAYMENT-SIGNATURE or X-PAYMENT)
  const paymentSig = req.headers["payment-signature"] || req.headers["x-payment"];

  if (paymentSig) {
    // Client sent payment — accept the request
    res.writeHead(200, {
      "Content-Type": "application/json",
      "X-PAYMENT-RESPONSE": "",
    });
    res.end(
      JSON.stringify({
        message: "Payment accepted! Here is your paid content.",
        data: { secret: "x402-payment-verified" },
      }),
    );
    console.log(`✅ Payment received from ${req.socket.remoteAddress}`);
    return;
  }

  // No payment — return 402
  const encoded = encodePaymentRequiredHeader(paymentRequired);

  res.writeHead(402, {
    "Content-Type": "application/json",
    "PAYMENT-REQUIRED": encoded,
  });
  res.end(
    JSON.stringify({
      error: "Payment required",
      x402Version: 2,
    }),
  );
  console.log(`📤 402 sent to ${req.socket.remoteAddress}`);
});

server.listen(PORT, () => {
  console.log(`🔒 x402 测试服务端已启动`);
  console.log(`   URL: http://localhost:${PORT}/api/paid-content`);
  console.log(`   网络: eip155:${CHAIN_ID} (Monad Testnet)`);
  console.log(`   金额: ${AMOUNT} ${ASSET}`);
  console.log(`   收款: ${PAY_TO}`);
  console.log("");
  console.log("测试命令:");
  console.log(`   npx tsx src/cli.ts pay --mode x402 --to http://localhost:${PORT}/api/paid-content --amount ${AMOUNT} --token ${ASSET} --reason "x402 test" --agent test-agent`);
});
