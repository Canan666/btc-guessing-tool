// pages/api/btc-price.ts

import type { NextApiRequest, NextApiResponse } from 'next';

type Data = { rate: number } | { error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  try {
    const binanceRes = await fetch(
      'https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT'
    );
    if (!binanceRes.ok) {
      throw new Error(`Binance API 返回状态 ${binanceRes.status}`);
    }
    const data = (await binanceRes.json()) as { symbol: string; price: string };
    const rate = parseFloat(data.price);
    // 在 Vercel 上缓存 5 秒，过期后 stale-while-revalidate
    res.setHeader('Cache-Control', 's-maxage=5, stale-while-revalidate');
    return res.status(200).json({ rate });
  } catch (err) {
    console.error('获取币安价格失败：', err);
    return res.status(500).json({ error: 'Failed to fetch price from Binance' });
  }
}
