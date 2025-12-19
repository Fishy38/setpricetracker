"use client";

import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
  TimeScale,
} from "chart.js";
import { Line } from "react-chartjs-2";
import "chartjs-adapter-date-fns";

ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement, Tooltip, Legend, TimeScale);

type PriceHistoryPoint = {
  retailer: string;
  price: number | null;
  recordedAt: string;
};

type Props = {
  history: PriceHistoryPoint[];
};

export function PriceChart({ history }: Props) {
  if (!history.length) return null;

  const grouped = history.reduce<Record<string, PriceHistoryPoint[]>>((acc, entry) => {
    if (!acc[entry.retailer]) acc[entry.retailer] = [];
    acc[entry.retailer].push(entry);
    return acc;
  }, {});

  const datasets = Object.entries(grouped).map(([retailer, entries]) => ({
    label: retailer,
    data: entries.map((e) => ({
      x: e.recordedAt,
      y: e.price ? e.price / 100 : null,
    })),
    borderColor: retailer === "LEGO" ? "green" : "gray",
    backgroundColor: "transparent",
  }));

  return (
    <div className="mt-4">
      <h3 className="text-sm font-semibold text-gray-300 mb-2">Price History</h3>
      <Line
        data={{ datasets }}
        options={{
          responsive: true,
          plugins: { legend: { display: true } },
          scales: {
            x: {
              type: "time",
              time: {
                tooltipFormat: "PP",
                unit: "day",
              },
              title: {
                display: true,
                text: "Date",
              },
            },
            y: {
              title: {
                display: true,
                text: "Price (USD)",
              },
            },
          },
        }}
      />
    </div>
  );
}