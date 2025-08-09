import React from "react";
import type { CriteriaResult, CriterionAssessment, StructuredAssessment } from "@/types/assessment";

const ICON: Record<CriteriaResult["status"], string> = {
  approved: "✅",
  partial: "⚠️",
  rejected: "❌",
  unknown: "❓",
};

function Section({ title, children }: { title: string; children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <div className="mt-4">
      <h4 className="font-medium text-sm">{title}</h4>
      <div className="mt-1 text-sm">{children}</div>
    </div>
  );
}

export default function CriterionCard({
  brief,
  detailed,
}: {
  brief: CriteriaResult;
  detailed?: CriterionAssessment;
}) {
  const structured = (detailed?.assessment ?? null) as StructuredAssessment | null;
  const used = detailed?.used_chunks ?? [];

  return (
    <div className="rounded-2xl border p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">{ICON[brief.status]}</span>
            <h3 className="text-base md:text-lg font-semibold">
              {brief.title} <span className="opacity-60">({brief.id})</span>
            </h3>
          </div>
          {brief.points ? (
            <div className="text-sm opacity-70 mt-1">Poeng: {brief.points}</div>
          ) : null}
        </div>
        <div className="text-xs opacity-70 text-right">
          {brief.page_references?.slice(0, 3).map((p) => (
            <div key={p}>{p}</div>
          ))}
        </div>
      </div>

      {/* Kort oppsummering (kommer fra begrunnelse_kort) */}
      {brief.summary && <p className="mt-3 text-sm">{brief.summary}</p>}

      {/* Detaljer dersom strukturert JSON finnes */}
      {structured ? (
        <>
          <Section title="Kravvurdering">
            <ul className="list-disc pl-5">
              {structured.kravvurdering?.map((k, i) => (
                <li key={i}>
                  <span className={k.oppfylt ? "text-green-700" : "text-red-700"}>
                    {k.oppfylt ? "Oppfylt" : "Ikke oppfylt"}
                  </span>
                  {": "} {k.krav}
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Metode etterlevd">
            <div>
              {structured.metode_etterlevd?.ja ? "Ja" : "Nei"}
              {structured.metode_etterlevd?.henvisning_chunk_ids?.length
                ? ` (ref: ${structured.metode_etterlevd.henvisning_chunk_ids.join(", ")})`
                : null}
            </div>
          </Section>

          <Section title="Fase-dokumentasjonskrav">
            <div>
              {structured.fase_dokkrav_oppfylt?.ja ? "Ja" : "Nei"}
              {structured.fase_dokkrav_oppfylt?.mangler?.length ? (
                <ul className="list-disc pl-5 mt-1">
                  {structured.fase_dokkrav_oppfylt.mangler.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </Section>

          <Section title="Mangler">
            {structured.mangler?.length ? (
              <ul className="list-disc pl-5">
                {structured.mangler.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            ) : (
              <div>Ingen registrert.</div>
            )}
          </Section>

          <Section title="Anbefalinger">
            {structured.anbefalinger?.length ? (
              <ul className="list-disc pl-5">
                {structured.anbefalinger.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            ) : (
              <div>Ingen anbefalinger registrert.</div>
            )}
          </Section>

          <Section title="Brukt dokumentasjon">
            {used.length ? (
              <ul className="divide-y">
                {used.slice(0, 5).map((u, i) => (
                  <li key={i} className="py-2">
                    <div className="text-sm font-medium">{u.source}</div>
                    <div className="text-xs opacity-70">
                      {u.page ? `Side ${u.page}` : "Side ukjent"}
                      {typeof u.relevance === "number" ? ` • Relevans ${Math.round(u.relevance * 100)}%` : ""}
                    </div>
                    <div className="text-xs mt-1">{u.content_preview}</div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-sm">Ingen lenket dokumentasjon.</div>
            )}
          </Section>
        </>
      ) : null}
    </div>
  );
}