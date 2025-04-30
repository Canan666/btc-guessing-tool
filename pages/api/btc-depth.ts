// pages/api/btc-depth.ts

import type { NextApiRequest, NextApiResponse } from 'next';

type DepthResult = {
  recommendation: '看涨' | '看跌';
  riskIndex: '低' | '中等' | '高';
  analysisDetail: string;
} | { error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<DepthResult>
) {
  try {
    const resp = await fetch(
      'https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=20'
    );
    if (!resp.ok) {
      return res
        .status(resp.status)
        .json({ error: `Binance K线 API 错误状态 ${resp.status}` });
    }
    const data = (await resp.json()) as any[];
    const closes = data.map((k) => parseFloat(k[4]));
    const avg =
      closes.reduce((sum, price) => sum + price, 0) / closes.length;
    const variance =
      closes.reduce((sum, price) => sum + (price - avg) ** 2, 0) /
      closes.length;
    const stddev = Math.sqrt(variance);
    const volRatio = stddev / avg;
    const lastPrice = closes[closes.length - 1];

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
  } catch (err: any) {
    console.error('btc-depth error', err);
    return res.status(500).json({ error: 'Depth analysis failed' });
  }
}
