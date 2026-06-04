export type ImportJobStatus =
  | "queued"
  | "parsing"
  | "validating"
  | "persisting"
  | "completed"
  | "failed"
  | "cancelled";

export interface ValidationError {
  sheet?: string;
  row: number;
  field: string;
  message: string;
}

export interface EntitySummary {
  entity: string;
  inserted: number;
  skipped: number;
  errors: string[];
}

export interface ImportJob {
  id: string;
  user_id: string;
  file_name: string;
  file_size_bytes: number;
  storage_path: string;
  status: ImportJobStatus;
  progress_pct: number;
  current_step: string | null;
  total_rows: number | null;
  processed_rows: number;
  total_chunks: number | null;
  processed_chunks: number;
  inserted_count: number;
  skipped_count: number;
  validation_errors: ValidationError[] | null;
  result_summary: EntitySummary[] | null;
  error_message: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}