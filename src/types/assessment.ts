export type CriteriaStatus = "approved" | "partial" | "rejected" | "unknown";

export interface CriteriaResult {
  id: string;
  title: string;
  status: CriteriaStatus;
  points: number;
  summary: string;
  page_references: string[];
}

export interface PointsSummary {
  achieved: number;
  possible: number;
  percentage: number;
  text: string;
}

// Strengt JSON-svar pr. kriterium (fra GPT)
export interface StructuredAssessment {
  status: "Oppnådd" | "Delvis oppnådd" | "Ikke oppnådd" | "Ikke vurderbart";
  begrunnelse_kort: string;
  metode_etterlevd: { ja: boolean; henvisning_chunk_ids?: number[] };
  fase_dokkrav_oppfylt: { ja: boolean; mangler?: string[]; henvisning_chunk_ids?: number[] };
  kravvurdering: { krav: string; oppfylt: boolean; henvisning_chunk_ids?: number[] }[];
  dokumentasjonsgrunnlag: { chunk_id: number; dekker_krav: string }[];
  mangler: string[];
  anbefalinger: string[];
  _phase_note?: { missing_documents?: string[] }; // valgfri annotasjon fra backend
}

export interface UsedChunk {
  source: string;
  page?: number | string | null;
  relevance?: number;
  content_preview: string;
}

export interface CriterionAssessment {
  criterion_id: string;
  title: string;
  status: "✅" | "⚠️" | "❌" | "❓";
  assessment: StructuredAssessment | string; // fallback kan være tekst
  used_chunks?: UsedChunk[];
  points?: number;
  success?: boolean;
}

export interface AssessmentAPIResponse {
  success: boolean;
  message: string;
  assessment_id: string;
  assessment: string; // kan være kort/fritekst eller "Vurdering generert per kriterium (strukturert)."
  assessment_summary: string;
  report_file?: string | null;
  word_file?: string | null;
  criteria_results: CriteriaResult[];
  criterion_assessments: CriterionAssessment[];
  points_summary: PointsSummary;
  metadata: {
    assessment_id: string;
    version: string;
    topic: string;
    phase: string;
    processing_time: string;
    processing_seconds: number;
    timestamp: string;
  };
  files_processed: string[];
  criteria_evaluated: number[];
  processing_time: number;
}