// pages/index.tsx

import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableRow, TableCell, TableBody } from "@/components/ui/table";

const riskAssessment = (price: number, timeframe: string) => {
  if (price <= 94200) return { prediction: "涨", reason: "价格接近日内支撑位，易反弹", risk: "低" };
  if (price >= 94800) return { prediction: "跌", reason: "价格接近阻力位，易回落", risk: "中等" };
  return { prediction: "震荡/观望", reason: "当前价格处于中性区间，方向不明朗", risk: "高" };
};

const coins = ["BTC", "ETH", "BNB"];

export default function BTCGuessingTool() {
  const [price, setPrice] = useState(0);
  const [prevPrice, setPrevPrice] = useState(0);
  const [coin, setCoin] = useState("BTC");
  const [timeframe, setTimeframe] = useState("10分钟");
  const [result, setResult] = useState<null | { prediction: string; reason: string; risk: string }>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [chartType, setChartType] = useState<"line" | "candlestick">("line");

  const priceColor = price > prevPrice ? "text-green-600" : price < prevPrice ? "text-red-600" : "text-gray-800";

  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${coin}USDT`);
        const data = await res.json();
        setPrevPrice(price);
        setPrice(parseFloat(data.price));
      } catch (error) {
        console.error("获取价格失败", error);
      }
    };

    fetchPrice();
    const interval = setInterval(fetchPrice, 1000); // 每秒更新
    return () => clearInterval(interval);
  }, [coin, price]);

  const handleAnalyze = () => {
    const analysis = riskAssessment(price, timeframe);
    setResult(analysis);
    const timestamp = new Date().toLocaleString();
    setHistory((prev) => [...prev, { time: timestamp, coin, price, timeframe, ...analysis }]);
  };

  const handleExport = () => {
    const headers = ["时间", "币种", "价格", "周期", "预测", "理由", "风险"].join(",");
    const rows = history.map(h => [h.time, h.coin, h.price, h.timeframe, h.prediction, h.reason, h.risk].join(","));
    const csvContent = [headers, ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "guess_history.csv");
    link.click();
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6 bg-gray-50 min-h-screen">
      <Card className="shadow-xl border border-gray-200">
        <CardContent className="space-y-4 p-6">
          <h2 className="text-2xl font-bold text-gray-800">币种模拟竞猜工具</h2>
          <div className="flex items-center gap-4">
            <label className="text-sm text-gray-600">选择币种：</label>
            <select
              className="p-2 border border-gray-300 rounded-lg"
              value={coin}
              onChange={(e) => setCoin(e.target.value)}
            >
              {coins.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="text-base text-gray-600">
            当前价格：<span className={`font-semibold transition-all duration-300 ${priceColor}`}>${price.toFixed(2)} USD</span>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">选择预测周期：</label>
            <RadioGroup value={timeframe} onValueChange={setTimeframe} className="flex gap-4">
              <RadioGroupItem value="10分钟">10分钟</RadioGroupItem>
              <RadioGroupItem value="30分钟">30分钟</RadioGroupItem>
              <RadioGroupItem value="1小时">1小时</RadioGroupItem>
              <RadioGroupItem value="1天">1天</RadioGroupItem>
            </RadioGroup>
          </div>
          <Button onClick={handleAnalyze} className="mt-4 w-full">开始分析</Button>
        </CardContent>
      </Card>

      {result && (
        <Card className="shadow-md border border-gray-200">
          <CardContent className="space-y-3 p-6">
            <h3 className="text-lg font-semibold text-gray-800">分析结果</h3>
            <div className="text-base text-gray-700"><strong>预测方向：</strong><span className="text-indigo-600 font-semibold">{result.prediction}</span></div>
            <div className="text-sm text-gray-600"><strong>理由：</strong>{result.reason}</div>
            <div className="text-sm text-gray-600"><strong>风险指数：</strong>{result.risk}</div>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-md border border-gray-200">
        <CardContent className="space-y-4 p-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-800">图表展示</h3>
            <div className="flex items-center gap-2">
              <label className="text-sm">图表类型：</label>
              <select
                value={chartType}
                onChange={(e) => setChartType(e.target.value as "line" | "candlestick")}
                className="p-1 border rounded"
              >
                <option value="line">折线图</option>
                <option value="candlestick">K线图</option>
              </select>
            </div>
          </div>
          <div>
            <iframe
              src={`https://www.tradingview.com/widgetembed/?symbol=BINANCE:${coin}USDT&interval=${chartType === "line" ? "1" : "15"}&theme=light`}
              style={{ width: "100%", height: "400px", border: "none" }}
            />
          </div>
        </CardContent>
      </Card>

      {history.length > 0 && (
        <Card className="shadow-md border border-gray-200">
          <CardContent className="space-y-3 p-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-800">竞猜历史记录</h3>
              <Button onClick={handleExport}>导出CSV</Button>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableCell>时间</TableCell>
                    <TableCell>币种</TableCell>
                    <TableCell>价格</TableCell>
                    <TableCell>周期</TableCell>
                    <TableCell>预测</TableCell>
                    <TableCell>风险</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((h, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{h.time}</TableCell>
                      <TableCell>{h.coin}</TableCell>
                      <TableCell>${h.price}</TableCell>
                      <TableCell>{h.timeframe}</TableCell>
                      <TableCell>{h.prediction}</TableCell>
                      <TableCell>{h.risk}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
