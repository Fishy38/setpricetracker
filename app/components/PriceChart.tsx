// app/components/PriceChart.tsx
"use client";

import React, { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export type PriceHistoryRow = {
  recordedAt: string | Date;
  price: number | null; // cents
  retailer?: string | null;
  inStock?: boolean | null;
};

type RangeKey = "1m" | "3m" | "6m" | "1y" | "all";

function toMs(d: string | Date) {
  const t = d instanceof Date ? d.getTime() : new Date(d).getTime();
  return Number.isFinite(t) ? t : 0;
}

function fmtMoney(cents: number | null | undefined) {
  if (cents == null) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}

function fmtDateShort(ms: number) {
  const d = new Date(ms);
  // 12/21/2025 style
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

function fmtDateTooltip(ms: number) {
  const d = new Date(ms);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function rangeCutoffMs(range: RangeKey, maxMs: number) {
  const day = 24 * 60 * 60 * 1000;
  if (range === "1m") return maxMs - 30 * day;
  if (range === "3m") return maxMs - 90 * day;
  if (range === "6m") return maxMs - 180 * day;
  if (range === "1y") return maxMs - 365 * day;
  return 0;
}

export function PriceChart({ history }: { history: PriceHistoryRow[] }) {
  const [range, setRange] = useState<RangeKey>("all");

  const normalized = useMemo(() => {
    const rows = (history ?? [])
      .map((r) => {
        const ms = toMs(r.recordedAt);
        const cents = typeof r.price === "number" ? r.price : null;

        return {
          t: ms,
          dateLabel: fmtDateShort(ms),
          // recharts likes numbers, not null strings
          price: cents == null ? null : cents / 100,
          priceCents: cents,
        };
      })
      .filter((r) => r.t > 0)
      // keep null prices (for gaps) if you want, but charts look cleaner with only real prices:
      .filter((r) => r.price != null)
      .sort((a, b) => a.t - b.t);

    return rows;
  }, [history]);

  const filtered = useMemo(() => {
    if (!normalized.length) return [];
    const maxT = normalized[normalized.length - 1].t;
    const cutoff = rangeCutoffMs(range, maxT);
    return cutoff > 0 ? normalized.filter((r) => r.t >= cutoff) : normalized;
  }, [normalized, range]);

  const stats = useMemo(() => {
    if (!filtered.length) return null;
    const latest = filtered[filtered.length - 1].priceCents ?? null;

    let low: number | null = null;
    let high: number | null = null;

    for (const r of filtered) {
      const c = r.priceCents;
      if (c == null) continue;
      if (low == null || c < low) low = c;
      if (high == null || c > high) high = c;
    }

    return { low, high, latest };
  }, [filtered]);

  const yDomain = useMemo(() => {
    if (!filtered.length) return [0, 1] as [number, number];

    let min = Infinity;
    let max = -Infinity;

    for (const r of filtered) {
      if (typeof r.price === "number") {
        min = Math.min(min, r.price);
        max = Math.max(max, r.price);
      }
    }

    if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1] as [number, number];
    if (min === max) {
      // give it some headroom if only one point
      const pad = Math.max(1, min * 0.1);
      return [Math.max(0, min - pad), max + pad] as [number, number];
    }

    const pad = Math.max(1, (max - min) * 0.12);
    return [Math.max(0, min - pad), max + pad] as [number, number];
  }, [filtered]);

  if (filtered.length === 0) {
    return <div className="text-sm text-gray-400">No valid price points to chart.</div>;
  }

  const Button = ({
    k,
    label,
  }: {
    k: RangeKey;
    label: string;
  }) => {
    const active = range === k;
    return (
      <button
        onClick={() => setRange(k)}
        className={
          active
            ? "px-3 py-2 rounded-md bg-white text-black text-sm font-semibold"
            : "px-3 py-2 rounded-md border border-gray-800 bg-gray-900 text-sm text-gray-200 hover:bg-gray-800 hover:border-gray-700 transition"
        }
      >
        {label}
      </button>
    );
  };

  return (
    <div className="w-full">
      {/* top row: range buttons + quick stats */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
        <div className="flex gap-2 flex-wrap">
          <Button k="1m" label="1 Month" />
          <Button k="3m" label="3 Months" />
          <Button k="6m" label="6 Months" />
          <Button k="1y" label="1 Year" />
          <Button k="all" label="All" />
        </div>

        {stats && (
          <div className="flex gap-4 text-sm">
            <div className="text-gray-400">
              Low{" "}
              <span className="text-gray-200 font-semibold">{fmtMoney(stats.low)}</span>
            </div>
            <div className="text-gray-400">
              High{" "}
              <span className="text-gray-200 font-semibold">{fmtMoney(stats.high)}</span>
            </div>
            <div className="text-gray-400">
              Latest{" "}
              <span className="text-green-400 font-semibold">{fmtMoney(stats.latest)}</span>
            </div>
          </div>
        )}
      </div>

      {/* chart */}
      <div className="w-full h-[360px] bg-zinc-950 border border-gray-800 rounded-md p-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={filtered} margin={{ top: 10, right: 18, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis
              dataKey="t"
              type="number"
              domain={["dataMin", "dataMax"]}
              tickFormatter={(v) => fmtDateShort(Number(v))}
              tick={{ fill: "#9CA3AF", fontSize: 12 }}
              axisLine={{ stroke: "#374151" }}
              tickLine={{ stroke: "#374151" }}
              // make sure we don’t spam labels
              minTickGap={28}
            />
            <YAxis
              domain={yDomain}
              tickFormatter={(v) => `$${Number(v).toFixed(0)}`}
              tick={{ fill: "#9CA3AF", fontSize: 12 }}
              axisLine={{ stroke: "#374151" }}
              tickLine={{ stroke: "#374151" }}
              width={52}
            />

            <Tooltip
              contentStyle={{
                background: "#0b0b0b",
                border: "1px solid #374151",
                borderRadius: 8,
                color: "#E5E7EB",
              }}
              labelFormatter={(label) => fmtDateTooltip(Number(label))}
              // IMPORTANT: this signature avoids the TS formatter error you had
              formatter={(value: any) => {
                const n = typeof value === "number" ? value : Number(value);
                if (!Number.isFinite(n)) return ["—", "Price"];
                return [`$${n.toFixed(2)}`, "Price"];
              }}
            />

            <Line
              type="monotone"
              dataKey="price"
              stroke="#22c55e"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 text-xs text-gray-500">
        Showing {filtered.length} point{filtered.length === 1 ? "" : "s"} • Prices in USD
      </div>
    </div>
  );
}