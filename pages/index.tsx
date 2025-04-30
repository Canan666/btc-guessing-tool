import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Table, TableHeader, TableRow, TableCell, TableBody } from "@/components/ui/table";

const timeframeToMs = {
  "10分钟": 10 * 60 * 1000,
  "30分钟": 30 * 60 * 1000,
  "1小时": 60 * 60 * 1000,
  "1天": 24 * 60 * 60 * 1000,
};

const riskAssessment = (price: number) => {
  if (price <= 94200) return { prediction: "涨", reason: "价格接近日内支撑位，易反弹", risk: "低" };
  if (price >= 94800) return { prediction: "跌", reason: "价格接近阻力位，易回落", risk: "中等" };
  return { prediction: "震荡/观望", reason: "当前价格处于中性区间，方向不明朗", risk: "高" };
};

interface Prediction {
  time: string;
  price: number;
  timeframe: string;
  prediction: string;
  reason: string;
  risk: string;
  predictedPrice: number;
  endTime: number;
  actualPrice?: number;
  result?: "正确" | "错误" | "未知";
}

export default function BTCGuessingTool() {
  const [price, setPrice] = useState(0);
  const [timeframe, setTimeframe] = useState("10分钟");
  const [history, setHistory] = useState<Prediction[]>([]);

  // 定时获取 BTC 实时价格
  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const res = await fetch("/api/btc-price");
        const data = await res.json();
        setPrice(data.rate);
      } catch (error) {
        console.error("获取价格失败", error);
      }
    };
    fetchPrice();
    const interval = setInterval(fetchPrice, 1000);
    return () => clearInterval(interval);
  }, []);

  // 每秒检查是否有到期预测需要验证
  useEffect(() => {
    const interval = setInterval(async () => {
      const now = Date.now();
      const updated = await Promise.all(
        history.map(async (h) => {
          if (!h.actualPrice && now >= h.endTime) {
            try {
              const res = await fetch("/api/btc-price");
              const data = await res.json();
              const actual = data.rate;
              let result: "正确" | "错误" | "未知" = "未知";
              if (h.prediction === "涨") result = actual > h.predictedPrice ? "正确" : "错误";
              else if (h.prediction === "跌") result = actual < h.predictedPrice ? "正确" : "错误";
              else result = "未知";
              return { ...h, actualPrice: actual, result };
            } catch {
              return h;
            }
          }
          return h;
        })
      );
      setHistory(updated);
    }, 1000);
    return () => clearInterval(interval);
  }, [history]);

  const handleAnalyze = () => {
    const analysis = riskAssessment(price);
    const now = Date.now();
    const duration = timeframeToMs[timeframe as keyof typeof timeframeToMs] || 0;
    const newPrediction: Prediction = {
      time: new Date(now).toLocaleString(),
      price,
      timeframe,
      prediction: analysis.prediction,
      reason: analysis.reason,
      risk: analysis.risk,
      predictedPrice: price,
      endTime: now + duration,
    };
    setHistory((prev) => [...prev, newPrediction]);
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6 bg-gray-50 min-h-screen">
      <Card className="shadow-xl border border-gray-200">
        <CardContent className="space-y-4 p-6">
          <h2 className="text-2xl font-bold text-gray-800">BTC 模拟竞猜工具</h2>
          <div className="text-base text-gray-600">
            当前价格：
            <span className="text-green-600 font-semibold">${price.toFixed(2)} USD</span>
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

      {history.length > 0 && (
        <Card className="shadow-md border border-gray-200">
          <CardContent className="space-y-3 p-6">
            <h3 className="text-lg font-semibold text-gray-800">竞猜历史记录</h3>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableCell>时间</TableCell>
                    <TableCell>预测价格</TableCell>
                    <TableCell>周期</TableCell>
                    <TableCell>预测方向</TableCell>
                    <TableCell>当前价格</TableCell>
                    <TableCell>剩余时间</TableCell>
                    <TableCell>实际价格</TableCell>
                    <TableCell>预测结果</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((h, idx) => {
                    const remaining = h.actualPrice ? "已结束" : Math.max(0, Math.floor((h.endTime - Date.now()) / 1000)) + " 秒";
                    return (
                      <TableRow key={idx}>
                        <TableCell>{h.time}</TableCell>
                        <TableCell>${h.predictedPrice}</TableCell>
                        <TableCell>{h.timeframe}</TableCell>
                        <TableCell>{h.prediction}</TableCell>
                        <TableCell>${price}</TableCell>
                        <TableCell>{remaining}</TableCell>
                        <TableCell>{h.actualPrice ? `$${h.actualPrice}` : "等待中..."}</TableCell>
                        <TableCell>
                          {h.result ? (
                            <span className={h.result === "正确" ? "text-green-600" : "text-red-600"}>{h.result}</span>
                          ) : "等待中..."}
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
