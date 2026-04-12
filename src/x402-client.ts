import { wrapFetchWithPaymentFromConfig, x402ClientConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { toClientEvmSigner } from "@x402/evm";
import { createPublicClient, http, type Account } from "viem";

export interface X402Config {
  sessionKey: Account;
  rpcUrl: string;
  chainId: number;
}

/**
 * 构造 ClientEvmSigner
 * x402 需要 signTypedData + 可选的 readContract / getTransactionCount
 */
function buildSigner(sessionKey: Account, rpcUrl: string, chainId: number) {
  const publicClient = createPublicClient({
    transport: http(rpcUrl),
    chain: {
      id: chainId,
      name: "Monad",
      nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
      rpcUrls: { default: { http: [rpcUrl] } },
    } as any,
  });

  return toClientEvmSigner(
    {
      address: sessionKey.address,
      signTypedData: async (msg) => {
        if (!sessionKey.signTypedData) {
          throw new Error("Session key does not support signTypedData");
        }
        return sessionKey.signTypedData(msg as any);
      },
    },
    {
      readContract: publicClient.readContract.bind(publicClient),
      getTransactionCount: async ({ address }) =>
        Number(await publicClient.getTransactionCount({ address })),
      estimateFeesPerGas: () => publicClient.estimateFeesPerGas(),
    },
  );
}

/**
 * 使用 x402 协议访问付费 API
 *
 * 流程：
 * 1. 发起 fetch 请求
 * 2. 如果返回 402，自动解析 PaymentRequirements
 * 3. 用 Session Key 签名 EIP-712 授权（ERC-3009 或 Permit2）
 * 4. 附加 PAYMENT-SIGNATURE header 重试
 * 5. 返回最终响应
 */
export async function fetchWithX402(
  config: X402Config,
  url: string,
  init?: RequestInit,
): Promise<Response> {
  const signer = buildSigner(config.sessionKey, config.rpcUrl, config.chainId);

  const network = `eip155:${config.chainId}` as `eip155:${string}`;

  const x402Config: x402ClientConfig = {
    schemes: [
      {
        network,
        client: new ExactEvmScheme(signer),
      },
    ],
  };

  const fetchWithPay = wrapFetchWithPaymentFromConfig(
    globalThis.fetch.bind(globalThis),
    x402Config,
  );

  return fetchWithPay(url, init);
}

/**
 * 便捷函数：直接调用付费 API 并返回 JSON
 */
export async function callX402Api<T = any>(
  config: X402Config,
  url: string,
  options?: RequestInit,
): Promise<{ response: Response; data?: T; error?: string }> {
  try {
    const response = await fetchWithX402(config, url, options);
    const text = await response.text();
    let data: T | undefined;
    try {
      data = JSON.parse(text) as T;
    } catch {
      // Not JSON
    }

    if (!response.ok) {
      return {
        response,
        error: `HTTP ${response.status}: ${text.slice(0, 200)}`,
      };
    }
    return { response, data };
  } catch (error) {
    return {
      response: new Response(),
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
