// pages/api/btc-depth.ts

import type { NextApiRequest, NextApiResponse } from 'next';

type DepthResult =
  | {
      recommendation: '看涨' | '看跌';
      riskIndex: '低' | '中等' | '高';
      analysisDetail: string;
    }
  | { error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<DepthResult>
) {
  const symbol = 'BTCUSDT';
  const interval = '1h';
  const limit = 20;

  let raw: any[] | null = null;
  let lastErrMsg: string | null = null;

  // 1. Binance 多域名轮询
  for (const domain of [
    'api.binance.com',
    'api1.binance.com',
    'api2.binance.com',
    'api3.binance.com',
  ]) {
    const url = `https://${domain}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
    try {
      const resp = await fetch(url);
      if (!resp.ok) {
        lastErrMsg = `Binance ${domain} 返回 ${resp.status}`;
        continue;
      }
      raw = (await resp.json()) as any[];
      break;
    } catch (e: any) {
      lastErrMsg = `请求 Binance ${domain} 异常：${e.message}`;
    }
  }

  // 2. Binance 全部失败，再尝试 CoinGecko
  if (!raw) {
    try {
      const cgUrl =
        'https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=1&interval=hourly';
      const cgResp = await fetch(cgUrl);
      if (!cgResp.ok) {
        throw new Error(`CoinGecko 返回 ${cgResp.status}`);
      }
      const cgData = await cgResp.json();
      const prices: [number, number][] = cgData.prices;
      if (!Array.isArray(prices) || prices.length < limit) {
        throw new Error('CoinGecko 数据不足');
      }
      // 取最后 20 条收盘价
      raw = prices.slice(-limit).map(([time, price]) => [
        time,
        price,
        price,
        price,
        price,
      ]);
    } catch (e: any) {
      lastErrMsg = `CoinGecko 错误：${e.message}`;
    }
  }

  // 3. CoinGecko 也失败，再尝试 CoinCap
  if (!raw) {
    try {
      const ccUrl = `https://api.coincap.io/v2/assets/bitcoin/history?interval=h1&limit=${limit}`;
      const ccResp = await fetch(ccUrl);
      if (!ccResp.ok) {
        throw new Error(`CoinCap 返回 ${ccResp.status}`);
      }
      const ccData = await ccResp.json();
      const items: { priceUsd: string }[] = ccData.data;
      if (!Array.isArray(items) || items.length < limit) {
        throw new Error('CoinCap 数据不足');
      }
      // 收盘价取 priceUsd
      raw = items.map((it) => {
        const p = parseFloat(it.priceUsd);
        return [0, 0, 0, 0, p];
      });
    } catch (e: any) {
      lastErrMsg = `CoinCap 错误：${e.message}`;
    }
  }

  // 4. 如果仍然没有数据，才报错
  if (!raw) {
    console.error('[btc-depth] 全部来源失败：', lastErrMsg);
    return res.status(502).json({ error: `深度分析失败：${lastErrMsg}` });
  }

  // 5. 计算 20h SMA & 波动率
  const closes = raw.map((k) => parseFloat(k[4]));
  const avg = closes.reduce((a, b) => a + b, 0) / closes.length;
  const variance =
    closes.reduce((sum, price) => sum + (price - avg) ** 2, 0) /
    closes.length;
  const stddev = Math.sqrt(variance);
  const volRatio = stddev / avg;
  const lastPrice = closes[closes.length - 1];

  // 6. 生成推荐和风险评级
  const recommendation: '看涨' | '看跌' = lastPrice > avg ? '看涨' : '看跌';
  let riskIndex: '低' | '中等' | '高' = '中等';
  if (volRatio < 0.005) riskIndex = '低';
  else if (volRatio > 0.01) riskIndex = '高';

  const analysisDetail = `20h SMA=${avg.toFixed(
    2
  )}，波动率=${(volRatio * 100).toFixed(
    2
  )}% → 推荐${recommendation}，风险${riskIndex}`;

  // 7. 缓存 60s
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
  return res.status(200).json({ recommendation, riskIndex, analysisDetail });
}
