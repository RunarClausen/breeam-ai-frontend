import React from "react";
import type { PointsSummary } from "@/types/assessment";

export default function PointsSummaryView({ summary }: { summary: PointsSummary }) {
  return (
    <div className="rounded-2xl border p-4 shadow-sm">
      <div className="flex items-baseline justify-between">
        <h3 className="text-lg font-semibold">Poeng</h3>
        <span className="text-sm opacity-70">{summary.text}</span>
      </div>
      <div className="mt-3">
        <div className="w-full h-3 rounded bg-gray-200 overflow-hidden">
          <div
            className="h-3 rounded bg-emerald-500"
            style={{ width: `${Math.min(100, Math.max(0, summary.percentage))}%` }}
          />
        </div>
        <div className="mt-2 text-sm opacity-80">
          {summary.achieved} / {summary.possible} ({Math.round(summary.percentage)}%)
        </div>
      </div>
    </div>
  );
}