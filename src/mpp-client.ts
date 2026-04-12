import type { Account } from "viem";

export interface MppConfig {
  sessionKey: Account;
  rpcUrl: string;
  chainId: number;
  usdcContract?: string;
}

/**
 * MPP 支付客户端封装
 *
 * MVP 简化版：
 * - 如果有 USDC_CONTRACT，使用 MPP push 模式（ERC-20 transfer）
 * - 如果没有，fallback 到直接转账（见 direct-transfer.ts）
 *
 * 完整 MPP 实现需要 @monad-crypto/mpp + mppx，
 * 但 MVP 阶段我们先用简化逻辑跑通流程。
 */
export async function payWithMpp(
  config: MppConfig,
  to: string,
  amount: string,
  reason: string,
): Promise<{ txHash: string; status: string; note?: string }> {
  if (!config.usdcContract) {
    return {
      txHash: "",
      status: "fallback_to_direct",
      note: "No USDC contract configured. MPP requires an ERC-20 token. Falling back to direct transfer — caller should use direct mode instead.",
    };
  }

  // TODO: 集成 @monad-crypto/mpp 完整流程
  // 1. 调用付费 API，收到 402 challenge
  // 2. 用 mppx/client 创建 credential (push mode: ERC-20 transfer)
  // 3. 广播交易，等待 receipt
  // 4. 返回 txHash

  throw new Error(
    "MPP mode not fully implemented in MVP. Use --mode direct instead, or configure USDC_CONTRACT and implement @monad-crypto/mpp integration.",
  );
}
