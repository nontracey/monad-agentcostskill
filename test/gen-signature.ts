import { privateKeyToAccount } from 'viem/accounts';
import { createPublicClient, http } from 'viem';

const account = privateKeyToAccount('0xbe49a12d96d2592b76183dedf77c2b1fe09f83ef479cfe78c25fa655e929f359');
const rpcUrl = 'https://testnet-rpc.monad.xyz/';
const chainId = 10143;

async function main() {
  const publicClient = createPublicClient({
    transport: http(rpcUrl),
    chain: { id: chainId, name: 'Monad', nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 }, rpcUrls: { default: { http: [rpcUrl] } } } as any,
  });

  // 生成 nonce
  const nonceBytes = new Uint8Array(32);
  crypto.getRandomValues(nonceBytes);
  const nonce = '0x' + Array.from(nonceBytes).map(b => b.toString(16).padStart(2, '0')).join('');

  const now = Math.floor(Date.now() / 1000);
  const authorization = {
    from: account.address,
    to: '0xaF292eEdC0e22A2Ed1b5A304AB7073fb8bdF34ED',
    value: '10000',
    validAfter: (now - 60).toString(),
    validBefore: (now + 300).toString(),
    nonce: nonce,
  };

  console.log('NOW:', now);
  console.log('validAfter:', authorization.validAfter);
  console.log('validBefore:', authorization.validBefore);

  // EIP-712 typed data for TransferWithAuthorization
  const domain = {
    name: 'USD Coin',
    version: '2',
    chainId: chainId,
    verifyingContract: '0x534b2f3A21130d7a60830c2Df862319e593943A3',
  };

  const types = {
    EIP712Domain: [
      { name: 'name', type: 'string' },
      { name: 'version', type: 'string' },
      { name: 'chainId', type: 'uint256' },
      { name: 'verifyingContract', type: 'address' },
    ],
    TransferWithAuthorization: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'validAfter', type: 'uint256' },
      { name: 'validBefore', type: 'uint256' },
      { name: 'nonce', type: 'bytes32' },
    ],
  };

  try {
    const signature = await account.signTypedData({
      domain,
      types,
      primaryType: 'TransferWithAuthorization',
      message: {
        from: authorization.from,
        to: authorization.to,
        value: authorization.value,
        validAfter: authorization.validAfter,
        validBefore: authorization.validBefore,
        nonce: authorization.nonce,
      },
    });
    console.log('SIGNATURE:', signature);
    console.log('AUTHORIZATION:', JSON.stringify(authorization));
  } catch (e) {
    console.error('Sign error:', e);
  }
}

main().catch(console.error);