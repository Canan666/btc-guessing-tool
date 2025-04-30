// pages/api/btc-price.ts
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ rate: number } | { error: string }>
) {
  try {
    // 调用币安现货行情接口
    const binanceRes = await fetch(
      'https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT'
    );
    if (!binanceRes.ok) {
      throw new Error(`Binance API 返回 ${binanceRes.status}`);
    }
    const data = await binanceRes.json() as { symbol: string; price: string };

    // 把字符串 price 转成数值
    const rate = parseFloat(data.price);
    res.setHeader('Cache-Control', 's-maxage=5, stale-while-revalidate');
    return res.status(200).json({ rate });
  } catch (err) {
    console.error('获取币安价格失败：', err);
    return res.status(500).json({ error: 'Failed to fetch price from Binance' });
  }
}
