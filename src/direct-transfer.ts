import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  type Account,
  type Chain,
} from "viem";
import { erc20Abi } from "viem";

function makeChain(rpcUrl: string, chainId: number): Chain {
  return {
    id: chainId,
    name: "Monad",
    nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  } as Chain;
}

export async function sendDirect(
  sessionKey: Account,
  to: string,
  amount: string,
  token: string,
  rpcUrl: string,
  chainId: number,
  usdcContract?: string,
): Promise<{ txHash: string; status: "success" | "reverted" }> {
  const chain = makeChain(rpcUrl, chainId);

  const publicClient = createPublicClient({ transport: http(rpcUrl), chain });
  const walletClient = createWalletClient({
    account: sessionKey,
    transport: http(rpcUrl),
    chain,
  });

  let txHash: string;

  if (token.toUpperCase() === "MON") {
    txHash = await walletClient.sendTransaction({
      chain: null,
      to: to as `0x${string}`,
      value: parseEther(amount),
    });
  } else if (usdcContract) {
    // ERC-20 transfer
    const amountWei = parseEther(amount); // assumes 18 decimals for simplicity
    txHash = await walletClient.writeContract({
      chain: null,
      address: usdcContract as `0x${string}`,
      abi: erc20Abi,
      functionName: "transfer",
      args: [to as `0x${string}`, amountWei],
    });
  } else {
    throw new Error(
      `Token ${token} not supported without contract address. Set USDC_CONTRACT in .env or use MON.`,
    );
  }

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash as `0x${string}` });
  return { txHash, status: receipt.status };
}

export async function getBalance(
  address: string,
  token: string,
  rpcUrl: string,
  usdcContract?: string,
): Promise<string> {
  const publicClient = createPublicClient({
    transport: http(rpcUrl),
    chain: {
      id: 1,
      name: "Monad",
      nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
      rpcUrls: { default: { http: [rpcUrl] } },
    },
  });

  if (token.toUpperCase() === "MON") {
    const balance = await publicClient.getBalance({
      address: address as `0x${string}`,
    });
    const { formatEther } = await import("viem");
    return formatEther(balance);
  } else if (usdcContract) {
    const balance = await publicClient.readContract({
      address: usdcContract as `0x${string}`,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [address as `0x${string}`],
    });
    const { formatEther } = await import("viem");
    return formatEther(balance);
  }
  return "0";
}
