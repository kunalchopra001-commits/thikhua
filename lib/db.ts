import { createClient } from "@supabase/supabase-js";

export type Severity = "S1" | "S2" | "S3" | "S4";
export type EstimatedScale = "minor" | "major";
export type IssueStatus = "submitted" | "in_progress" | "overdue" | "unfunded" | "resolved";
export type ReporterMode = "anonymous" | "named_private" | "named_public";
export type CaptureProvenance = "live" | "upload";
export type StatusEventType =
  | "SUBMITTED"
  | "CORROBORATED"
  | "ACKNOWLEDGED"
  | "INSPECTION_ORDERED"
  | "MARKED_UNFUNDED"
  | "RESOLVED"
  | "REOPENED";

export type School = {
  id: string;
  udise_code: string;
  name_en: string;
  name_kn: string;
  block_id: string;
  block_name: string;
  district: string;
  state: string;
  is_urban: boolean;
  management_type: string;
  lat: number;
  lng: number;
  enrolment: number;
};

export type Issue = {
  id: string;
  code: string;
  school_id: string;
  category: string;
  severity: Severity;
  severity_reasoning: string;
  rte_entitlement_violated: boolean;
  estimated_scale: EstimatedScale;
  location_within_premises: string | null;
  grievance_authority: string;
  execution_authority: string;
  funding_pathway: string;
  statutory_limit_days: number;
  status: IssueStatus;
  created_at: string;
  resolved_at: string | null;
  resolution_photo_url: string | null;
};

export type Report = {
  id: string;
  issue_id: string;
  text_original: string;
  text_hindi: string;
  text_english_official: string;
  detected_language: string;
  photo_url: string;
  photo_urls: string[];
  reporter_mode: ReporterMode;
  reporter_name: string | null;
  reporter_contact: string | null;
  capture_provenance: CaptureProvenance;
  created_at: string;
};

export type StatusEvent = {
  id: string;
  issue_id: string;
  event_type: StatusEventType;
  actor_office: string;
  note: string;
  created_at: string;
};

export type SchoolInsert = Omit<School, "id"> & { id?: string };
export type IssueInsert = Omit<Issue, "id" | "created_at" | "statutory_limit_days"> & {
  id?: string;
  created_at?: string;
  statutory_limit_days?: number;
};
export type ReportInsert = Omit<Report, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
};
export type StatusEventInsert = Omit<StatusEvent, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
};

type TableDefinition<Row, Insert, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      schools: TableDefinition<School, SchoolInsert>;
      issues: TableDefinition<Issue, IssueInsert>;
      reports: TableDefinition<Report, ReportInsert>;
      status_events: TableDefinition<StatusEvent, StatusEventInsert, never>;
    };
    Views: Record<string, never>;
    Functions: {
      reset_seed_data: {
        Args: {
          seed_school_ids: string[];
          seed_issue_ids: string[];
          seed_report_ids: string[];
          seed_status_event_ids: string[];
        };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be configured",
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

function unwrap<T>(data: T | null, error: { message: string } | null): T {
  if (error) {
    throw new Error(error.message);
  }

  return data as T;
}

export async function getSchoolsByBlock(blockId: string) {
  const { data, error } = await supabase
    .from("schools")
    .select("*")
    .eq("block_id", blockId)
    .order("name_en");

  return unwrap(data, error);
}

export async function getIssuesByBlock(blockId: string) {
  const schools = await getSchoolsByBlock(blockId);

  if (schools.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("issues")
    .select("*")
    .in(
      "school_id",
      schools.map((school) => school.id),
    )
    .order("created_at", { ascending: false });

  return unwrap(data, error);
}

export async function getIssueByCode(code: string) {
  const { data, error } = await supabase.from("issues").select("*").eq("code", code).maybeSingle();

  return unwrap(data, error);
}

export async function getOpenIssuesBySchool(schoolId: string) {
  const { data, error } = await supabase
    .from("issues")
    .select("*")
    .eq("school_id", schoolId)
    .in("status", ["submitted", "in_progress", "overdue", "unfunded"])
    .order("created_at", { ascending: false });

  return unwrap(data, error);
}

export async function createIssue(issue: IssueInsert) {
  const { data, error } = await supabase.from("issues").insert(issue).select().single();

  return unwrap(data, error);
}

export async function appendStatusEvent(statusEvent: StatusEventInsert) {
  const { data, error } = await supabase
    .from("status_events")
    .insert(statusEvent)
    .select()
    .single();

  return unwrap(data, error);
}
