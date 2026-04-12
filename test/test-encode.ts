#!/usr/bin/env node
/**
 * 测试 PAYMENT-REQUIRED header 编码
 */
import { encodePaymentRequiredHeader } from "@x402/core/http";

const CHAIN_ID = 10143;
const MONAD_NETWORK = `eip155:${CHAIN_ID}`;
const USDC_CONTRACT = "0x534b2f3A21130d7a60830c2Df862319e593943A3";
const PAY_TO = "0xaF292eEdC0e22A2Ed1b5A304AB7073fb8bdF34ED";
const PRICE = "10000";

const paymentRequired = {
  x402Version: 2,
  resource: {
    url: "http://localhost:3456/api/paid-content",
    description: "Monad testnet x402 paid endpoint",
  },
  accepts: [{
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
  }],
};

console.log("PaymentRequired 对象:");
console.log(JSON.stringify(paymentRequired, null, 2));
console.log("");

try {
  const encoded = encodePaymentRequiredHeader(paymentRequired);
  console.log("✅ 编码成功:");
  console.log(encoded.slice(0, 200) + "...");
  console.log("");
  console.log("长度:", encoded.length);
} catch (e) {
  console.error("❌ 编码失败:", e);
}
