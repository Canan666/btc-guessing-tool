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
  const domains = [
    'api.binance.com',
    'api1.binance.com',
    'api2.binance.com',
    'api3.binance.com',
  ];

  let raw: any[] | null = null;
  let lastError: string | null = null;

  // 轮询不同的域名，直到获得 2xx 响应
  for (const domain of domains) {
    const url = `https://${domain}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
    try {
      const resp = await fetch(url);
      if (!resp.ok) {
        lastError = `域名 ${domain} 返回 ${resp.status}`;
        continue;
      }
      raw = (await resp.json()) as any[];
      break;
    } catch (err: any) {
      lastError = `域名 ${domain} 异常：${err.message}`;
    }
  }

  if (!raw) {
    console.error('[btc-depth] 全部域名调用失败：', lastError);
    return res.status(502).json({ error: `深度分析失败：${lastError}` });
  }

  // 计算 SMA & 波动率
  const closes = raw.map((k) => parseFloat(k[4]));
  const avg = closes.reduce((a, b) => a + b, 0) / closes.length;
  const variance =
    closes.reduce((sum, price) => sum + (price - avg) ** 2, 0) /
    closes.length;
  const stddev = Math.sqrt(variance);
  const volRatio = stddev / avg;
  const lastPrice = closes[closes.length - 1];

  // 生成推荐和风险评级
  const recommendation = lastPrice > avg ? '看涨' : '看跌';
  let riskIndex: '低' | '中等' | '高' = '中等';
  if (volRatio < 0.005) riskIndex = '低';
  else if (volRatio > 0.01) riskIndex = '高';

  const analysisDetail = `20h SMA=${avg.toFixed(
    2
  )}，波动率=${(volRatio * 100).toFixed(
    2
  )}% → 推荐${recommendation}，风险${riskIndex}`;

  // 缓存 60s
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
  return res.status(200).json({ recommendation, riskIndex, analysisDetail });
}
