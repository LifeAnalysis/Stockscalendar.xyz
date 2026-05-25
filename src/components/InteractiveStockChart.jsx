"use client";

import React, { useMemo } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { Card, CardContent } from "./ui/card.jsx";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "./ui/chart.jsx";

const chartConfig = {
  priceData: {
    label: "Price Data"
  },
  high: {
    label: "High",
    color: "#04151f"
  },
  close: {
    label: "Close",
    color: "#ccff00"
  },
  low: {
    label: "Low",
    color: "#407076"
  }
};

export const InteractiveStockChart = ({ chartData }) => {
  const formattedData = useMemo(
    () =>
      chartData
        .map((item) => {
          const close = Number(item.close);
          if (!Number.isFinite(close)) return null;
          const open = Number.isFinite(Number(item.open)) ? Number(item.open) : close;
          const high = Number.isFinite(Number(item.high)) ? Number(item.high) : Math.max(open, close);
          const low = Number.isFinite(Number(item.low)) ? Number(item.low) : Math.min(open, close);
          return {
            ...item,
            open,
            high,
            low,
            close,
            dateTime: new Date(item.date).getTime()
          };
        })
        .filter((item) => item && !Number.isNaN(item.dateTime))
        .sort((a, b) => a.dateTime - b.dateTime),
    [chartData]
  );

  const minValue = useMemo(
    () => Math.min(...formattedData.map((item) => Math.min(item.open, item.close))),
    [formattedData]
  );
  const maxValue = useMemo(
    () => Math.max(...formattedData.map((item) => Math.max(item.open, item.close))),
    [formattedData]
  );

  if (!formattedData.length) return <div className="chart-fallback chart-state">Chart unavailable from Yahoo.</div>;

  return (
    <Card className="interactive-stock-chart">
      <CardContent>
        <div className="interactive-chart-frame">
          <ChartContainer config={chartConfig} className="interactive-chart-container">
            <LineChart
              data={formattedData}
              margin={{
                top: 16,
                right: 12,
                left: 4,
                bottom: 8
              }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return date.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric"
                  });
                }}
              />
              <YAxis domain={[minValue * 0.9, maxValue * 1.1]} tickFormatter={(value) => `$${value.toFixed(2)}`} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    className="chart-tooltip-width"
                    labelFormatter={(value) => {
                      return new Date(value).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric"
                      });
                    }}
                  />
                }
              />
              <Line type="monotone" dataKey="high" stroke={chartConfig.high.color} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="close" stroke={chartConfig.close.color} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="low" stroke={chartConfig.low.color} strokeWidth={2} dot={false} />
            </LineChart>
          </ChartContainer>
        </div>
      </CardContent>
    </Card>
  );
};
