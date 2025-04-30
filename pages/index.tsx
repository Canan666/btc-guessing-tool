
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Table,
  TableHeader,
  TableRow,
  TableCell,
  TableBody,
} from "@/components/ui/table";

const timeframeToMs: Record<string, number> = {
  "10分钟": 10 * 60 * 1000,
  "30分钟": 30 * 60 * 1000,
  "1小时": 60 * 60 * 1000,
  "1天": 24 * 60 * 60 * 1000,
};

const riskAssessment = (price: number) => {
  if (price <= 94200) {
    return { prediction: "涨", reason: "价格接近日内支撑位，易反弹", risk: "低" };
  }
  if (price >= 94800) {
    return { prediction: "跌", reason: "价格接近阻力位，易回落", risk: "中等" };
  }
  return {
    prediction: "震荡/观望",
    reason: "当前价格处于中性区间，方向不明朗",
    risk: "高",
  };
};

interface Prediction {
  time: string;
  price: number;
  timeframe: string;
  prediction: string;
  reason: string;
  risk: string;
  analysisDetail: string;
  predictedPrice: number;
  endTime: number;
  actualPrice?: number;
  result?: "正确" | "错误" | "未知";
}

export default function BTCGuessingTool() {
  const [price, setPrice] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState("10分钟");
  const [history, setHistory] = useState<Prediction[]>([]);
  const [analysisDetail, setAnalysisDetail] = useState<string | null>(null);

  // 初始 fetch 回退
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/btc-price");
        const json = (await res.json()) as { rate?: number; error?: string };
        if (res.ok && typeof json.rate === "number") {
          setPrice(json.rate);
        }
      } catch {}
    })();
  }, []);

  // WebSocket 实时推送
  useEffect(() => {
    const ws = new WebSocket(
      "wss://stream.binance.com:9443/ws/btcusdt@ticker"
    );
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const last = parseFloat(msg.c);
        if (!isNaN(last)) {
          setPrice(last);
        }
      } catch {}
    };
    ws.onerror = () => setErrorMsg("WebSocket 连接出错");
    return () => ws.close();
  }, []);

  // 验证到期预测
  useEffect(() => {
    const iv = setInterval(() => {
      const now = Date.now();
      setHistory((prev) =>
        prev.map((h) => {
          if (!h.actualPrice && now >= h.endTime && price != null) {
            let result: "正确" | "错误" | "未知" = "未知";
            if (h.prediction === "涨") {
              result = price > h.predictedPrice ? "正确" : "错误";
            } else if (h.prediction === "跌") {
              result = price < h.predictedPrice ? "正确" : "错误";
            }
            return { ...h, actualPrice: price, result };
          }
          return h;
        })
      );
    }, 1000);
    return () => clearInterval(iv);
  }, [price]);

  const handleAnalyze = async () => {
    if (price == null) return;

    // 基础技术指标：20期SMA和波动率
    let analysisText = "";
    try {
      const res = await fetch(
        "/api/btc-depth?symbol=BTCUSDT&interval=1h&limit=20"
      );
      if (res.ok) {
        const klines = (await res.json()) as any[];
        const closes = klines.map((k) => parseFloat(k[4]));
        const sma = closes.reduce((a, b) => a + b, 0) / closes.length;
        const variance =
          closes.reduce((a, b) => a + Math.pow(b - sma, 2), 0) /
          closes.length;
        const std = Math.sqrt(variance);
        const volatility = std / sma;
        const recommendation = price > sma ? "涨" : "跌";
        const riskLevel =
          volatility < 0.005
            ? "低"
            : volatility < 0.01
            ? "中等"
            : "高";
        analysisText =
          `SMA(20h): ${sma.toFixed(2)}, 当前价格$${price.toFixed(
            2
          )}${
            price > sma ? "高于" : "低于"
          }平均线；波动率: ${(volatility * 100).toFixed(2)}%，风险等级: ${
            riskLevel
          }，建议${recommendation}`;
      }
    } catch {}

    const basic = riskAssessment(price);
    const now = Date.now();
    const duration = timeframeToMs[timeframe] || 0;
    const newPrediction: Prediction = {
      time: new Date(now).toLocaleString(),
      price,
      timeframe,
      prediction: basic.prediction,
      reason: basic.reason,
      risk: basic.risk,
      analysisDetail: analysisText || `${basic.reason}，风险: ${basic.risk}`,
      predictedPrice: price,
      endTime: now + duration,
    };
    setHistory((prev) => [...prev, newPrediction]);
    setAnalysisDetail(newPrediction.analysisDetail);
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6 bg-gray-50 min-h-screen">
      <Card className="shadow-xl border border-gray-200">
        <CardContent className="space-y-4 p-6">
          <h2 className="text-2xl font-bold text-gray-800">
            BTC 模拟竞猜工具
          </h2>
          <div className="text-base text-gray-600">
            当前价格：{' '}
            <span className="text-green-600 font-semibold">
              {price !== null ? `$${price.toFixed(2)} USD` : '加载中...'}
            </span>
          </div>
          {errorMsg && <div className="text-red-500 text-sm">{errorMsg}</div>}

          {analysisDetail && (
            <div className="p-4 bg-white rounded-lg border border-gray-200">
              <h3 className="text-lg font-medium">深度分析</h3>
              <p className="text-sm text-gray-700 mt-1">
                {analysisDetail}
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              选择预测周期：
            </label>
            <RadioGroup
              value={timeframe}
              onValueChange={setTimeframe}
              className="flex gap-4"
            >
              <RadioGroupItem value="10分钟">10分钟</RadioGroupItem>
              <RadioGroupItem value="30分钟">30分钟</RadioGroupItem>
              <RadioGroupItem value="1小时">1小时</RadioGroupItem>
              <RadioGroupItem value="1天">1天</RadioGroupItem>
            </RadioGroup>
          </div>

          <Button onClick={handleAnalyze} className="mt-4 w-full">
            开始分析
          </Button>
        </CardContent>
      </Card>

      {history.length > 0 && (
        <Card className="shadow-md border border-gray-200">
          <CardContent className="space-y-3 p-6">
            <h3 className="text-lg font-semibold text-gray-800">
              竞猜历史记录
            </h3>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableCell>时间</TableCell>
                    <TableCell>预测价格</TableCell>
                    <TableCell>周期</TableCell>
                    <TableCell>预测方向</TableCell>
                    <TableCell>当前价格</TableCell>
                    <TableCell>深度分析</TableCell>
                    <TableCell>剩余时间</TableCell>
                    <TableCell>实际价格</TableCell>
                    <TableCell>预测结果</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((h, idx) => {
                    const remaining =
                      h.actualPrice != null
                        ? '已结束'
                        : `${Math.max(
                            0,
                            Math.floor((h.endTime - Date.now()) / 1000)
                          )} 秒`;
                    return (
                      <TableRow key={idx}>
                        <TableCell>{h.time}</TableCell>
                        <TableCell>${h.predictedPrice}</TableCell>
                        <TableCell>{h.timeframe}</TableCell>
                        <TableCell>{h.prediction}</TableCell>
                        <TableCell>
                          {price !== null ? `$${price.toFixed(2)}` : '加载中...'}
                        </TableCell>
                        <TableCell title={h.analysisDetail}>
                          {h.analysisDetail}
                        </TableCell>
                        <TableCell>{remaining}</TableCell>
                        <TableCell>
                          {h.actualPrice != null
                            ? `$${h.actualPrice}`
                            : '等待中...'}
                        </TableCell>
                        <TableCell>
                          {h.result ? (
                            <span
                              className={
                                h.result === '正确'
                                  ? 'text-green-600'
                                  : 'text-red-600'
                              }
                            >
                              {h.result}
                            </span>
                          ) : (
                            '等待中...'
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
