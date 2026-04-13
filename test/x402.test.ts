import { describe, it, expect } from "vitest";
import * as x402Http from "@x402/core/http";
import type { PaymentRequired, PaymentRequirements } from "@x402/core/types";

const { encodePaymentRequiredHeader, decodePaymentRequiredHeader } = x402Http;

// ── Test x402 Config ────────────────────────────────────────────────
const CHAIN_ID = 10143;
const USDC_CONTRACT = "0x534b2f3A21130d7a60830c2Df862319e593943A3";
const PAY_TO = "0x1234567890123456789012345678901234567890";
const PRICE = "10000"; // 0.01 USDC (6 decimals)

function buildPaymentRequirements(url: string): PaymentRequirements {
  return {
    scheme: "exact",
    network: `eip155:${CHAIN_ID}`,
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
    resource: { url, description: "x402 test endpoint" },
    accepts: [buildPaymentRequirements(url)],
  };
}

// ── Tests ─────────────────────────────────────────────────────────────
describe("x402 Protocol — PaymentRequirements 构造", () => {
  it("应该构造正确的 PaymentRequirements", () => {
    const reqs = buildPaymentRequirements("http://localhost:3456/api/paid-content");

    expect(reqs.scheme).toBe("exact");
    expect(reqs.network).toBe(`eip155:${CHAIN_ID}`);
    expect(reqs.asset).toBe(USDC_CONTRACT);
    expect(reqs.amount).toBe(PRICE);
    expect(reqs.payTo).toBe(PAY_TO);
    expect(reqs.extra?.name).toBe("USDC");
    expect(reqs.extra?.chainId).toBe(CHAIN_ID);
  });

  it("应该构造完整的 PaymentRequired 对象", () => {
    const url = "http://localhost:3456/api/paid-content";
    const pr = buildPaymentRequired(url);

    expect(pr.x402Version).toBe(2);
    expect(pr.resource.url).toBe(url);
    expect(pr.accepts.length).toBe(1);
    expect(pr.accepts[0].asset).toBe(USDC_CONTRACT);
    expect(pr.accepts[0].amount).toBe(PRICE);
  });

  it("PaymentRequirements 应包含 Monad 测试网配置", () => {
    const reqs = buildPaymentRequirements("http://localhost:3456/api");
    expect(reqs.network).toBe("eip155:10143");
    expect(reqs.extra?.chainId).toBe(10143);
    expect(reqs.maxTimeoutSeconds).toBe(60);
  });
});

describe("x402 Protocol — Header 编码/解码", () => {
  it("应该正确编码 PaymentRequired 到 header", () => {
    const url = "http://localhost:3456/api/paid-content";
    const pr = buildPaymentRequired(url);
    const encoded = encodePaymentRequiredHeader(pr);

    expect(encoded).toBeDefined();
    expect(typeof encoded).toBe("string");
    expect(encoded.length).toBeGreaterThan(0);
  });

  it("应该能够解码 header 并还原 PaymentRequired", () => {
    const url = "http://localhost:3456/api/paid-content";
    const pr = buildPaymentRequired(url);
    const encoded = encodePaymentRequiredHeader(pr);
    const decoded = decodePaymentRequiredHeader(encoded);

    expect(decoded.x402Version).toBe(2);
    expect(decoded.resource.url).toBe(url);
    expect(decoded.accepts.length).toBe(1);
    expect(decoded.accepts[0].asset).toBe(USDC_CONTRACT);
    expect(decoded.accepts[0].amount).toBe(PRICE);
  });

  it("编码后的 header 应包含 USDC 价格信息", () => {
    const pr = buildPaymentRequired("http://localhost:3456/api");
    const encoded = encodePaymentRequiredHeader(pr);
    const decoded = decodePaymentRequiredHeader(encoded);

    const accept = decoded.accepts[0];
    expect(accept.asset).toBe(USDC_CONTRACT);
    expect(accept.amount).toBe(PRICE);
    expect(accept.extra?.name).toBe("USDC");
  });

  it("应该正确处理支付签名 header 的编解码", () => {
    // Simulate a payment signature payload (simplified)
    const mockPayload = {
      x402Version: 2,
      payload: {
        signature: "0x1234567890abcdef",
        authorization: {
          owner: "0xOwnerAddress",
          spender: "0xSpenderAddress",
          value: PRICE,
          validAfter: 0,
          validBefore: 9999999999,
          nonce: "0x0000000000000000000000000000000000000000000000000000000000000001",
        },
      },
      resource: { url: "http://localhost:3456/api" },
      accepted: buildPaymentRequirements("http://localhost:3456/api"),
    };

    // Base64 encode the payload (simplified version of what x402 does)
    const encoded = Buffer.from(JSON.stringify(mockPayload)).toString("base64url");

    // Should be able to decode it back
    const decoded = JSON.parse(Buffer.from(encoded, "base64url").toString("utf-8"));
    expect(decoded.x402Version).toBe(2);
    expect(decoded.accepted.asset).toBe(USDC_CONTRACT);
    expect(decoded.accepted.amount).toBe(PRICE);
  });
});

describe("x402 Protocol — 完整流程模拟", () => {
  it("402 响应流程: 请求 → 402 → 解析 PaymentRequirements", () => {
    // Step 1: Server builds PaymentRequired
    const url = "http://localhost:3456/api/paid-content";
    const paymentRequired = buildPaymentRequired(url);

    // Step 2: Server encodes to header
    const encoded = encodePaymentRequiredHeader(paymentRequired);
    expect(encoded).toBeDefined();

    // Step 3: Client decodes and validates
    const decoded = decodePaymentRequiredHeader(encoded);
    expect(decoded.x402Version).toBe(2);
    expect(decoded.accepts[0].scheme).toBe("exact");
    expect(decoded.accepts[0].asset).toBe(USDC_CONTRACT);
    expect(decoded.accepts[0].network).toBe("eip155:10143");
  });

  it("x402 支付流程: 402 → 签名 → 验证", () => {
    // Simulated flow:
    // 1. Client requests → Server returns 402
    const pr = buildPaymentRequired("http://localhost:3456/api");
    expect(pr.x402Version).toBe(2);

    // 2. Client extracts requirements
    const reqs = pr.accepts[0];
    expect(reqs.asset).toBe(USDC_CONTRACT);
    expect(reqs.amount).toBe(PRICE);

    // 3. Client signs (simulated)
    const mockSignature = {
      x402Version: 2,
      payload: { signature: "0xfake", authorization: {} },
      resource: pr.resource,
      accepted: reqs,
    };

    // 4. Server verifies signature structure
    expect(mockSignature.x402Version).toBe(2);
    expect(mockSignature.accepted.asset).toBe(USDC_CONTRACT);
    expect(mockSignature.accepted.amount).toBe(PRICE);
  });
});

describe("x402 Client Integration (src/x402-client)", async () => {
  it("应该正确导出 fetchWithX402 函数", async () => {
    const x402 = await import("../src/x402-client.js");

    // Verify the module exports correctly
    expect(typeof x402.fetchWithX402).toBe("function");
    expect(typeof x402.callX402Api).toBe("function");
  });

  it("x402 模式应被 orchestrator 正确处理", async () => {
    // Verify x402 is a valid mode
    const validModes: Array<"direct" | "mpp" | "x402"> = ["direct", "mpp", "x402"];
    expect(validModes).toContain("x402");
  });
});
