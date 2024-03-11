import { deepStrictEqual, throws } from 'node:assert';
import { describe, should } from 'micro-should';
import { bytesToHex, concatBytes, hexToBytes } from '@noble/hashes/utils';
import * as uniswap2 from '../lib/esm/net/uniswap-v2.js';
import * as uniswap3 from '../lib/esm/net/uniswap-v3.js';
import { ethDecimal, strip0x } from '../lib/esm/utils.js';

const vitalik = '0xd8da6bf26964af9d7eed9e03e53415d37aa96045';
const TS = 1876543210;

describe('uniswap', () => {
  should('pair', () => {
    deepStrictEqual(
      uniswap2.pairAddress(
        '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        '0x6B175474E89094C44Da98b954EedeAC495271d0F',
        '0x1111111111111111111111111111111111111111'
      ),
      '0xb50b5182D6a47EC53a469395AF44e371d7C76ed4'.toLowerCase()
    );
    deepStrictEqual(
      uniswap2.pairAddress(
        '0x6B175474E89094C44Da98b954EedeAC495271d0F',
        '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        '0x1111111111111111111111111111111111111111'
      ),
      '0xb50b5182D6a47EC53a469395AF44e371d7C76ed4'.toLowerCase()
    );
    // Real mainnet factory
    deepStrictEqual(
      uniswap2.pairAddress(
        '0x6B175474E89094C44Da98b954EedeAC495271d0F',
        '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
      ),
      '0xAE461cA67B15dc8dc81CE7615e0320dA1A9aB8D5'.toLowerCase()
    );
    throws(() =>
      uniswap2.pairAddress(
        '0x6B175474E89094C44Da98b954EedeAC495271d0F',
        '0x6b175474e89094c44da98b954eedeac495271d0f'
      )
    );
    // WETH: 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2
    // USDC: 0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48
    // WETH-USDC 0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc
    deepStrictEqual(
      uniswap2.pairAddress(
        '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
      ),
      '0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc'.toLowerCase()
    );
    deepStrictEqual(
      uniswap2.pairAddress('eth', '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'),
      '0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc'.toLowerCase()
    );
  });
  should('amount', () => {
    const dec = (n) => ethDecimal.encode(n);
    const [rA, rB] = [296640198432632702024n, 365918988101684615226n];
    deepStrictEqual(dec(uniswap2.amount(rA, rB, 1000000000000000000n)), '1.225724583682887052');
    deepStrictEqual(dec(uniswap2.amount(rA, rB, 100000000000000000000n)), '92.047496716230633056');
    deepStrictEqual(
      dec(uniswap2.amount(rA, rB, undefined, 1000000000000000000n)),
      '0.815339312352237873'
    );
    deepStrictEqual(
      dec(uniswap2.amount(rA, rB, undefined, 100000000000000000000n)),
      '111.888511214298320788'
    );
    deepStrictEqual(dec(uniswap2.amount(rB, rA, 1000000000000000000n)), '0.806043583348492768');
    deepStrictEqual(dec(uniswap2.amount(rB, rA, 100000000000000000000n)), '63.517658298923822555');
    deepStrictEqual(
      dec(uniswap2.amount(rB, rA, undefined, 1000000000000000000n)),
      '1.241441624624184708'
    );
    deepStrictEqual(
      dec(uniswap2.amount(rB, rA, undefined, 100000000000000000000n)),
      '186.64548305577605772'
    );
  });
  should('txData', () => {
    const LABRA = '0x106d3c66d22d2dd0446df23d7f5960752994d600';
    const WETH = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
    const tx0 = uniswap2.txData(
      vitalik,
      'eth',
      LABRA,
      {
        path: [WETH, LABRA],
        amountIn: 100000000000000000n,
        amountOut: 13580246791358024680n,
      },
      100000000000000000n,
      undefined,
      { deadline: TS, slippagePercent: 10 }
    );
    deepStrictEqual(
      bytesToHex(tx0.data),
      '7ff36ab5000000000000000000000000000000000000000000000000a99e0e4144ee17840000000000000000000000000000000000000000000000000000000000000080000000000000000000000000d8da6bf26964af9d7eed9e03e53415d37aa96045000000000000000000000000000000000000000000000000000000006fd9c6ea0000000000000000000000000000000000000000000000000000000000000002000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2000000000000000000000000106d3c66d22d2dd0446df23d7f5960752994d600'
    );
    deepStrictEqual(tx0.value, 100000000000000000n);
    const LAYER = '0x0ff6ffcfda92c53f615a4a75d982f399c989366b';
    const USDT = '0xdac17f958d2ee523a2206206994597c13d831ec7';
    const tx1 = uniswap2.txData(
      vitalik,
      LAYER,
      USDT,
      {
        path: [LAYER, WETH, USDT],
        amountIn: 98765432109876543212n,
        amountOut: 12345678901234567891n,
      },
      98765432109876543212n,
      undefined,
      { deadline: TS, slippagePercent: 10 }
    );
    deepStrictEqual(
      bytesToHex(tx1.data),
      '38ed17390000000000000000000000000000000000000000000000055aa54d38e5267eec0000000000000000000000000000000000000000000000009a3298986d3589bd00000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000d8da6bf26964af9d7eed9e03e53415d37aa96045000000000000000000000000000000000000000000000000000000006fd9c6ea00000000000000000000000000000000000000000000000000000000000000030000000000000000000000000ff6ffcfda92c53f615a4a75d982f399c989366b000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2000000000000000000000000dac17f958d2ee523a2206206994597c13d831ec7'
    );
    deepStrictEqual(tx1.value, 0n);
    const PLUTON = '0xd8912c10681d8b21fd3742244f44658dba12264e';
    const tx2 = uniswap2.txData(
      vitalik,
      PLUTON,
      'eth',
      {
        path: [PLUTON, WETH],
        amountIn: 98765432109876543212n,
        amountOut: 12345678901234567891n,
      },
      98765432109876543212n,
      undefined,
      { deadline: TS, slippagePercent: 10 }
    );
    deepStrictEqual(
      bytesToHex(tx2.data),
      '18cbafe50000000000000000000000000000000000000000000000055aa54d38e5267eec0000000000000000000000000000000000000000000000009a3298986d3589bd00000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000d8da6bf26964af9d7eed9e03e53415d37aa96045000000000000000000000000000000000000000000000000000000006fd9c6ea0000000000000000000000000000000000000000000000000000000000000002000000000000000000000000d8912c10681d8b21fd3742244f44658dba12264e000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'
    );
    deepStrictEqual(tx2.value, 0n);
    const TRUBIT = '0xf65b5c5104c4fafd4b709d9d60a185eae063276c';
    const tx3 = uniswap2.txData(
      vitalik,
      'eth',
      TRUBIT,
      {
        path: [WETH, TRUBIT],
        amountIn: 98765432109876543212n,
        amountOut: 12345678901234567891n,
      },
      undefined,
      12345678901234567891n,
      { deadline: TS, slippagePercent: 10 }
    );
    deepStrictEqual(
      bytesToHex(tx3.data),
      'fb3bdb41000000000000000000000000000000000000000000000000ab54a98ceb1f0ad30000000000000000000000000000000000000000000000000000000000000080000000000000000000000000d8da6bf26964af9d7eed9e03e53415d37aa96045000000000000000000000000000000000000000000000000000000006fd9c6ea0000000000000000000000000000000000000000000000000000000000000002000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2000000000000000000000000f65b5c5104c4fafd4b709d9d60a185eae063276c'
    );
    deepStrictEqual(tx3.value, 108641975320864197533n);
  });

  should('UniswapV3: txData', () => {
    const WETH = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
    const USDT = '0xdac17f958d2ee523a2206206994597c13d831ec7';
    const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
    const SHIB = '0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce';
    // Eth -> token (single)
    const tx0 = uniswap3.txData(
      vitalik,
      'eth',
      SHIB,
      {
        fee: uniswap3.Fee.HIGH,
        // (12345678901234567891n * 100n)/90n
        amountOut: 13717421001371742101n,
      },
      98765432109876543212n,
      undefined,
      { deadline: TS, slippagePercent: 10 }
    );
    deepStrictEqual(
      bytesToHex(tx0.data),
      '414bf389000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc200000000000000000000000095ad61b0a150d79219dcf64e1e6cc01f0b64c4ce0000000000000000000000000000000000000000000000000000000000002710000000000000000000000000d8da6bf26964af9d7eed9e03e53415d37aa96045000000000000000000000000000000000000000000000000000000006fd9c6ea0000000000000000000000000000000000000000000000055aa54d38e5267eec000000000000000000000000000000000000000000000000ab54a98ceb1f0ad20000000000000000000000000000000000000000000000000000000000000000'
    );
    deepStrictEqual(tx0.value, 98765432109876543212n);
    // token -> eth
    const PRQ = '0x362bc847a3a9637d3af6624eec853618a43ed7d2';
    const tx1 = uniswap3.txData(
      vitalik,
      PRQ,
      'eth',
      {
        path: concatBytes(
          hexToBytes(strip0x(PRQ)),
          hexToBytes('002710'), // HIGH
          hexToBytes(strip0x(USDT)),
          hexToBytes('0001f4'), // LOW
          hexToBytes(strip0x(WETH))
        ),
        // 12345678901234567891n * 100n/90n
        amountOut: 13717421001371742101n,
      },
      98765432109876543212n,
      undefined,
      { deadline: TS, slippagePercent: 10 }
    );
    deepStrictEqual(
      bytesToHex(tx1.data),
      'ac9650d800000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000001c00000000000000000000000000000000000000000000000000000000000000144c04b8d59000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000006fd9c6ea0000000000000000000000000000000000000000000000055aa54d38e5267eec000000000000000000000000000000000000000000000000ab54a98ceb1f0ad20000000000000000000000000000000000000000000000000000000000000042362bc847a3a9637d3af6624eec853618a43ed7d2002710dac17f958d2ee523a2206206994597c13d831ec70001f4c02aaa39b223fe8d0a0e5c4f27ead9083c756cc200000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000004449404b7c000000000000000000000000000000000000000000000000ab54a98ceb1f0ad2000000000000000000000000d8da6bf26964af9d7eed9e03e53415d37aa9604500000000000000000000000000000000000000000000000000000000'
    );
    deepStrictEqual(tx1.value, 0n);
    deepStrictEqual(tx1.allowance, { token: PRQ, amount: 98765432109876543212n });
    const tx2 = uniswap3.txData(
      vitalik,
      'eth',
      USDT,
      {
        path: concatBytes(
          hexToBytes(strip0x(USDT)),
          hexToBytes('0001f4'), // LOW
          hexToBytes(strip0x(USDC)),
          hexToBytes('0001f4'), // LOW
          hexToBytes(strip0x(WETH))
        ),
        // 98765432109876543211n * 100n/110n
        amountIn: 89786756463524130191n,
      },
      undefined,
      12345678901234567891n,
      { deadline: TS, slippagePercent: 10 }
    );
    deepStrictEqual(
      bytesToHex(tx2.data),
      'ac9650d800000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000001c00000000000000000000000000000000000000000000000000000000000000144f28c0498000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000d8da6bf26964af9d7eed9e03e53415d37aa96045000000000000000000000000000000000000000000000000000000006fd9c6ea000000000000000000000000000000000000000000000000ab54a98ceb1f0ad30000000000000000000000000000000000000000000000055aa54d38e5267eea0000000000000000000000000000000000000000000000000000000000000042dac17f958d2ee523a2206206994597c13d831ec70001f4a0b86991c6218b36c1d19d4a2e9eb0ce3606eb480001f4c02aaa39b223fe8d0a0e5c4f27ead9083c756cc200000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000412210e8a00000000000000000000000000000000000000000000000000000000'
    );
    deepStrictEqual(tx2.value, 98765432109876543210n);
  });
});

// ESM is broken.
import url from 'node:url';
if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  should.run();
}
