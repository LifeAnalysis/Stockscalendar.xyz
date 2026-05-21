"use client";

import React, { useMemo } from "react";
import { Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";
import { Card, CardContent } from "./ui/card.jsx";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "./ui/chart.jsx";

const chartConfig = {
  close: {
    label: "Close",
    color: "var(--chart-1)"
  },
  volume: {
    label: "Volume",
    color: "var(--chart-1)"
  }
};

const formatMoney = (value) =>
  new Intl.NumberFormat("en", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 100 ? 2 : 4
  }).format(value);

const formatCompact = (value) =>
  new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(value);

const rangeLabel = {
  "1mo": "1 month",
  "3mo": "3 months",
  "6mo": "6 months",
  "1y": "1 year"
};

export const InteractiveStockChart = ({ chartData, ticker, range }) => {
  const formattedData = useMemo(
    () =>
      chartData
        .map((item) => ({
          ...item,
          dateTime: new Date(item.date).getTime()
        }))
        .filter((item) => !Number.isNaN(item.dateTime))
        .sort((a, b) => a.dateTime - b.dateTime),
    [chartData]
  );

  const closeValues = useMemo(
    () => formattedData.map((item) => item.close).filter((value) => typeof value === "number" && Number.isFinite(value)),
    [formattedData]
  );
  const volumeValues = useMemo(
    () => formattedData.map((item) => item.volume || 0).filter((value) => typeof value === "number" && Number.isFinite(value)),
    [formattedData]
  );
  const minValue = useMemo(
    () => (closeValues.length ? Math.min(...closeValues) : 0),
    [closeValues]
  );
  const maxValue = useMemo(
    () => (closeValues.length ? Math.max(...closeValues) : 0),
    [closeValues]
  );
  const maxVolume = useMemo(
    () => (volumeValues.length ? Math.max(...volumeValues) : 0),
    [volumeValues]
  );
  const firstClose = closeValues[0] || 0;
  const lastClose = closeValues[closeValues.length - 1] || 0;
  const absoluteChange = lastClose - firstClose;
  const percentChange = firstClose ? (absoluteChange / firstClose) * 100 : 0;
  const isUp = absoluteChange >= 0;
  const pricePadding = Math.max((maxValue - minValue) * 0.16, lastClose * 0.01, 1);

  return (
    <Card className="interactive-stock-chart">
      <div className="stock-chart-card-header">
        <div>
          <div className="stock-chart-card-title">{ticker || "Stock"} price</div>
          <div className="stock-chart-card-description">
            Yahoo historical close with volume{rangeLabel[range] ? `, ${rangeLabel[range]}` : ""}
          </div>
        </div>
        <div className="chart-readout">
          <strong>{lastClose ? formatMoney(lastClose) : "n/a"}</strong>
          <span className={isUp ? "up" : "down"}>
            {isUp ? "+" : ""}
            {formatMoney(absoluteChange)} ({isUp ? "+" : ""}
            {percentChange.toFixed(2)}%)
          </span>
        </div>
      </div>
      <CardContent>
        <div className="interactive-chart-frame">
          <ChartContainer config={chartConfig} className="interactive-chart-container">
            <ComposedChart
              data={formattedData}
              margin={{
                top: 16,
                right: 10,
                left: 0,
                bottom: 6
              }}
            >
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
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
              <YAxis
                yAxisId="price"
                domain={[Math.max(minValue - pricePadding, 0), maxValue + pricePadding]}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                width={58}
                tickFormatter={(value) => `$${Number(value).toFixed(0)}`}
              />
              <YAxis yAxisId="volume" orientation="right" hide domain={[0, maxVolume * 4 || 1]} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    className="chart-tooltip-width"
                    formatter={(value, name) => (
                      <>
                        <div
                          className="tooltip-indicator line"
                          style={{
                            "--color-bg": name === "volume" ? "var(--border)" : "var(--chart-1)",
                            "--color-border": name === "volume" ? "var(--border)" : "var(--chart-1)"
                          }}
                        />
                        <div className="tooltip-item-body items-center">
                          <div className="tooltip-item-label">
                            <span>{name === "volume" ? "Volume" : "Close"}</span>
                          </div>
                          <span className="tooltip-value">
                            {name === "volume" ? formatCompact(value) : formatMoney(value)}
                          </span>
                        </div>
                      </>
                    )}
                    labelFormatter={(value) => {
                      return new Date(value).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric"
                      });
                    }}
                  />
                }
              />
              <Bar
                yAxisId="volume"
                dataKey="volume"
                fill="var(--border)"
                opacity={0.42}
                radius={[2, 2, 0, 0]}
                isAnimationActive={false}
              />
              <Line
                yAxisId="price"
                type="monotone"
                dataKey="close"
                stroke={chartConfig.close.color}
                strokeWidth={2.4}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            </ComposedChart>
          </ChartContainer>
        </div>
      </CardContent>
    </Card>
  );
};
