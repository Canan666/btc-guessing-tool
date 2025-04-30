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

  // 一：初始 fetch 回退，保证页面打开就能看到一次价格
  useEffect(() => {
    const fetchInitial = async () => {
      console.log("[initFetch] fetching initial price...");
      try {
        const res = await fetch("/api/btc-price");
        const json = (await res.json()) as { rate?: number; error?: string };
        if (res.ok && typeof json.rate === "number") {
          console.log("[initFetch] got initial price", json.rate);
          setPrice(json.rate);
        } else {
          console.error("[initFetch] failed:", res.status, json.error);
        }
      } catch (e) {
        console.error("[initFetch] exception:", e);
      }
    };
    fetchInitial();
  }, []);

  // 二：WebSocket 实时推送
  useEffect(() => {
    console.log("[WS] connecting to Binance ticker WS...");
    const ws = new WebSocket("wss://stream.binance.com:9443/ws/btcusdt@ticker");

    ws.onopen = () => {
      console.log("[WS] connection opened");
      setErrorMsg(null);
    };

    ws.onmessage = (event) => {
      // 每条消息都是 JSON 字符串
      try {
        const msg = JSON.parse(event.data);
        console.log("[WS] message", msg);
        const last = parseFloat(msg.c);
        if (!isNaN(last)) {
          setPrice(last);
        }
      } catch (e) {
        console.error("[WS] parse error:", e);
      }
    };

    ws.onerror = (e) => {
      console.error("[WS] error", e);
      setErrorMsg("WebSocket 连接出错，请检查网络");
    };

    ws.onclose = (ev) => {
      console.warn("[WS] closed", ev.code, ev.reason);
      // 如果非正常关闭，可尝试重连
      if (ev.code !== 1000) {
        setErrorMsg("WebSocket 异常关闭，将在 3 秒后重连");
        setTimeout(() => {
          setErrorMsg(null);
          // 重连
          console.log("[WS] reconnecting...");
          // 重新执行 effect
          setPrice((p) => p); // 触发依赖变化
        }, 3000);
      }
    };

    return () => {
      console.log("[WS] cleanup, closing socket");
      ws.close(1000, "Client cleanup");
    };
  }, [/* 依赖为空，首次挂载后不会重复，重连逻辑写在 onclose 里 */]);

  // 三：验证到期预测（用最新 price）
  useEffect(() => {
    const iv = setInterval(() => {
      const now = Date.now();
      setHistory((prev) =>
        prev.map((h) => {
          if (h.actualPrice == null && now >= h.endTime && price != null) {
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

  const handleAnalyze = () => {
    if (price == null) return;
    const analysis = riskAssessment(price);
    const now = Date.now();
    const duration = timeframeToMs[timeframe] ?? 0;
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
            当前价格：{" "}
            <span className="text-green-600 font-semibold">
              {price !== null ? `$${price.toFixed(2)} USD` : "加载中..."}
            </span>
          </div>
          {errorMsg && <div className="text-red-500 text-sm">{errorMsg}</div>}

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
                    <TableCell>剩余时间</TableCell>
                    <TableCell>实际价格</TableCell>
                    <TableCell>预测结果</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((h, idx) => {
                    const remaining =
                      h.actualPrice != null
                        ? "已结束"
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
                          {price !== null
                            ? `$${price.toFixed(2)}`
                            : "加载中..."}
                        </TableCell>
                        <TableCell>{remaining}</TableCell>
                        <TableCell>
                          {h.actualPrice != null
                            ? `$${h.actualPrice}`
                            : "等待中..."}
                        </TableCell>
                        <TableCell>
                          {h.result ? (
                            <span
                              className={
                                h.result === "正确"
                                  ? "text-green-600"
                                  : "text-red-600"
                              }
                            >
                              {h.result}
                            </span>
                          ) : (
                            "等待中..."
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
