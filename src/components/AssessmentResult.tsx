import React, { useMemo } from "react";
import type { AssessmentAPIResponse, CriterionAssessment } from "@/types/assessment";
import PointsSummaryView from "./PointsSummary";
import CriterionCard from "./CriterionCard";

export default function AssessmentResult({ data }: { data: AssessmentAPIResponse }) {
  const byId = useMemo(() => {
    const m = new Map<string, CriterionAssessment>();
    for (const ca of data.criterion_assessments || []) {
      if (ca?.criterion_id) m.set(String(ca.criterion_id), ca);
    }
    return m;
  }, [data.criterion_assessments]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl md:text-2xl font-semibold">Vurdering</h2>
          <div className="text-sm opacity-70">
            {data.metadata.topic} • {data.metadata.version} • Fase: {data.metadata.phase}
          </div>
        </div>
        <div className="text-sm opacity-70">
          {data.report_file ? (
            <a className="underline" href={data.report_file} target="_blank" rel="noreferrer">
              Last ned rapport
            </a>
          ) : null}
        </div>
      </div>

      {/* Kort oppsummering (kan være kort eller tom hvis legacy er av) */}
      {data.assessment ? (
        <div className="rounded-2xl border p-4 shadow-sm">
          <div className="text-sm whitespace-pre-wrap">{data.assessment}</div>
        </div>
      ) : null}

      <PointsSummaryView summary={data.points_summary} />

      <div className="grid grid-cols-1 gap-4">
        {data.criteria_results.map((cr) => (
          <CriterionCard key={cr.id} brief={cr} detailed={byId.get(cr.id)} />
        ))}
      </div>
    </div>
  );
}