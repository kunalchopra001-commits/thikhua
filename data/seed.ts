import { deriveAuthorities } from "../lib/authorities.ts";
import type {
  CaptureProvenance,
  EstimatedScale,
  IssueInsert,
  ReportInsert,
  ReporterMode,
  SchoolInsert,
  Severity,
  StatusEventInsert,
  StatusEventType,
} from "../lib/db.ts";

export type BlockCentroid = {
  block_id: string;
  block_name: string;
  district: string;
  is_urban: boolean;
  lat: number;
  lng: number;
};

export const BLOCK_CENTROIDS: readonly BlockCentroid[] = [
  {
    block_id: "bengaluru-east-urban",
    block_name: "Bengaluru East",
    district: "Bengaluru Urban",
    is_urban: true,
    lat: 12.9784,
    lng: 77.6408,
  },
  {
    block_id: "hanur-rural",
    block_name: "Hanur",
    district: "Chamarajanagar",
    is_urban: false,
    lat: 12.0965,
    lng: 77.2852,
  },
] as const;

export const SCHOOLS: SchoolInsert[] = [
  {
    id: "10000000-0000-4000-8000-000000000001",
    udise_code: "FICTKA00001",
    name_en: "Government Namma Jyothi Higher Primary School",
    name_kn: "ಸರ್ಕಾರಿ ನಮ್ಮ ಜ್ಯೋತಿ ಹಿರಿಯ ಪ್ರಾಥಮಿಕ ಶಾಲೆ",
    block_id: "bengaluru-east-urban",
    block_name: "Bengaluru East",
    district: "Bengaluru Urban",
    state: "Karnataka",
    is_urban: true,
    management_type: "Department of Education",
    lat: 12.9912,
    lng: 77.6519,
    enrolment: 428,
  },
  {
    id: "10000000-0000-4000-8000-000000000002",
    udise_code: "FICTKA00002",
    name_en: "Government Samata Kannada Primary School",
    name_kn: "ಸರ್ಕಾರಿ ಸಮತಾ ಕನ್ನಡ ಪ್ರಾಥಮಿಕ ಶಾಲೆ",
    block_id: "bengaluru-east-urban",
    block_name: "Bengaluru East",
    district: "Bengaluru Urban",
    state: "Karnataka",
    is_urban: true,
    management_type: "Department of Education",
    lat: 12.9708,
    lng: 77.6321,
    enrolment: 316,
  },
  {
    id: "10000000-0000-4000-8000-000000000003",
    udise_code: "FICTKA00003",
    name_en: "Government Arivu Girls High School",
    name_kn: "ಸರ್ಕಾರಿ ಅರಿವು ಬಾಲಕಿಯರ ಪ್ರೌಢಶಾಲೆ",
    block_id: "bengaluru-east-urban",
    block_name: "Bengaluru East",
    district: "Bengaluru Urban",
    state: "Karnataka",
    is_urban: true,
    management_type: "Department of Education",
    lat: 12.9826,
    lng: 77.6228,
    enrolment: 512,
  },
  {
    id: "10000000-0000-4000-8000-000000000004",
    udise_code: "FICTKA00004",
    name_en: "Government Neela Akasha Model School",
    name_kn: "ಸರ್ಕಾರಿ ನೀಲ ಆಕಾಶ ಮಾದರಿ ಶಾಲೆ",
    block_id: "bengaluru-east-urban",
    block_name: "Bengaluru East",
    district: "Bengaluru Urban",
    state: "Karnataka",
    is_urban: true,
    management_type: "Department of Education",
    lat: 12.9635,
    lng: 77.6594,
    enrolment: 603,
  },
  {
    id: "10000000-0000-4000-8000-000000000005",
    udise_code: "FICTKA00005",
    name_en: "Government Hosa Belaku Primary School",
    name_kn: "ಸರ್ಕಾರಿ ಹೊಸ ಬೆಳಕು ಪ್ರಾಥಮಿಕ ಶಾಲೆ",
    block_id: "bengaluru-east-urban",
    block_name: "Bengaluru East",
    district: "Bengaluru Urban",
    state: "Karnataka",
    is_urban: true,
    management_type: "Department of Education",
    lat: 12.9871,
    lng: 77.6742,
    enrolment: 274,
  },
  {
    id: "10000000-0000-4000-8000-000000000006",
    udise_code: "FICTKA00006",
    name_en: "Government Sahaja Composite School",
    name_kn: "ಸರ್ಕಾರಿ ಸಹಜ ಸಂಯುಕ್ತ ಶಾಲೆ",
    block_id: "bengaluru-east-urban",
    block_name: "Bengaluru East",
    district: "Bengaluru Urban",
    state: "Karnataka",
    is_urban: true,
    management_type: "Department of Education",
    lat: 12.9549,
    lng: 77.6437,
    enrolment: 389,
  },
  {
    id: "10000000-0000-4000-8000-000000000007",
    udise_code: "FICTKA00007",
    name_en: "Government Kaveri Bana Higher Primary School",
    name_kn: "ಸರ್ಕಾರಿ ಕಾವೇರಿ ಬನ ಹಿರಿಯ ಪ್ರಾಥಮಿಕ ಶಾಲೆ",
    block_id: "hanur-rural",
    block_name: "Hanur",
    district: "Chamarajanagar",
    state: "Karnataka",
    is_urban: false,
    management_type: "Department of Education",
    lat: 12.1042,
    lng: 77.2728,
    enrolment: 146,
  },
  {
    id: "10000000-0000-4000-8000-000000000008",
    udise_code: "FICTKA00008",
    name_en: "Government Bettada Hoovu Primary School",
    name_kn: "ಸರ್ಕಾರಿ ಬೆಟ್ಟದ ಹೂವು ಪ್ರಾಥಮಿಕ ಶಾಲೆ",
    block_id: "hanur-rural",
    block_name: "Hanur",
    district: "Chamarajanagar",
    state: "Karnataka",
    is_urban: false,
    management_type: "Department of Education",
    lat: 12.0876,
    lng: 77.2984,
    enrolment: 92,
  },
  {
    id: "10000000-0000-4000-8000-000000000009",
    udise_code: "FICTKA00009",
    name_en: "Government Hasiru Daari High School",
    name_kn: "ಸರ್ಕಾರಿ ಹಸಿರು ದಾರಿ ಪ್ರೌಢಶಾಲೆ",
    block_id: "hanur-rural",
    block_name: "Hanur",
    district: "Chamarajanagar",
    state: "Karnataka",
    is_urban: false,
    management_type: "Department of Education",
    lat: 12.1131,
    lng: 77.3047,
    enrolment: 231,
  },
  {
    id: "10000000-0000-4000-8000-000000000010",
    udise_code: "FICTKA00010",
    name_en: "Government Jenu Goodu Primary School",
    name_kn: "ಸರ್ಕಾರಿ ಜೇನು ಗೂಡು ಪ್ರಾಥಮಿಕ ಶಾಲೆ",
    block_id: "hanur-rural",
    block_name: "Hanur",
    district: "Chamarajanagar",
    state: "Karnataka",
    is_urban: false,
    management_type: "Department of Education",
    lat: 12.0759,
    lng: 77.2816,
    enrolment: 78,
  },
  {
    id: "10000000-0000-4000-8000-000000000011",
    udise_code: "FICTKA00011",
    name_en: "Government Male Mahadesha Composite School",
    name_kn: "ಸರ್ಕಾರಿ ಮಲೆ ಮಹದೇಶ ಸಂಯುಕ್ತ ಶಾಲೆ",
    block_id: "hanur-rural",
    block_name: "Hanur",
    district: "Chamarajanagar",
    state: "Karnataka",
    is_urban: false,
    management_type: "Department of Education",
    lat: 12.1228,
    lng: 77.2605,
    enrolment: 184,
  },
  {
    id: "10000000-0000-4000-8000-000000000012",
    udise_code: "FICTKA00012",
    name_en: "Government Aranya Mitra Primary School",
    name_kn: "ಸರ್ಕಾರಿ ಅರಣ್ಯ ಮಿತ್ರ ಪ್ರಾಥಮಿಕ ಶಾಲೆ",
    block_id: "hanur-rural",
    block_name: "Hanur",
    district: "Chamarajanagar",
    state: "Karnataka",
    is_urban: false,
    management_type: "Department of Education",
    lat: 12.0914,
    lng: 77.2493,
    enrolment: 113,
  },
];

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

type IssueDraft = {
  id: string;
  code: string;
  school_id: string;
  category: string;
  severity: Severity;
  severity_reasoning: string;
  rte_entitlement_violated: boolean;
  estimated_scale: EstimatedScale;
  location_within_premises: string | null;
  status: "resolved" | "in_progress" | "overdue" | "submitted";
  age_days: number;
  resolved_days_ago?: number;
  resolution_photo_url: string | null;
};

const ISSUE_DRAFTS: IssueDraft[] = [
  {
    id: "20000000-0000-4000-8000-000000000001",
    code: "S1AWPB",
    school_id: "10000000-0000-4000-8000-000000000007",
    category: "structural",
    severity: "S1",
    severity_reasoning: "A visibly sagging classroom roof beam presents a danger to life.",
    rte_entitlement_violated: true,
    estimated_scale: "major",
    location_within_premises: "Classroom 4, roof beam",
    status: "overdue",
    age_days: 210,
    resolution_photo_url: null,
  },
  {
    id: "20000000-0000-4000-8000-000000000002",
    code: "WATR90",
    school_id: "10000000-0000-4000-8000-000000000009",
    category: "water",
    severity: "S2",
    severity_reasoning: "The only drinking-water tap is non-functional.",
    rte_entitlement_violated: true,
    estimated_scale: "minor",
    location_within_premises: "Drinking-water point beside the kitchen",
    status: "overdue",
    age_days: 132,
    resolution_photo_url: null,
  },
  {
    id: "20000000-0000-4000-8000-000000000003",
    code: "ELEC65",
    school_id: "10000000-0000-4000-8000-000000000001",
    category: "electrical",
    severity: "S1",
    severity_reasoning: "An exposed live wire is reachable beside a classroom doorway.",
    rte_entitlement_violated: true,
    estimated_scale: "minor",
    location_within_premises: "Classroom 2 entrance",
    status: "in_progress",
    age_days: 65,
    resolution_photo_url: null,
  },
  {
    id: "20000000-0000-4000-8000-000000000004",
    code: "TOIL38",
    school_id: "10000000-0000-4000-8000-000000000003",
    category: "sanitation",
    severity: "S2",
    severity_reasoning: "The girls' toilet block has no working water supply.",
    rte_entitlement_violated: true,
    estimated_scale: "minor",
    location_within_premises: "Girls' toilet block",
    status: "in_progress",
    age_days: 38,
    resolution_photo_url: null,
  },
  {
    id: "20000000-0000-4000-8000-000000000005",
    code: "RAMP20",
    school_id: "10000000-0000-4000-8000-000000000006",
    category: "accessibility",
    severity: "S3",
    severity_reasoning: "The main teaching block has no accessible ramp for children with disabilities.",
    rte_entitlement_violated: true,
    estimated_scale: "major",
    location_within_premises: "Main teaching block entrance",
    status: "in_progress",
    age_days: 20,
    resolution_photo_url: null,
  },
  {
    id: "20000000-0000-4000-8000-000000000006",
    code: "DESK02",
    school_id: "10000000-0000-4000-8000-000000000005",
    category: "furniture",
    severity: "S4",
    severity_reasoning: "Several desks have broken seats and cannot be used safely.",
    rte_entitlement_violated: false,
    estimated_scale: "minor",
    location_within_premises: "Classroom 5",
    status: "submitted",
    age_days: 2,
    resolution_photo_url: null,
  },
  {
    id: "20000000-0000-4000-8000-000000000007",
    code: "WALL06",
    school_id: "10000000-0000-4000-8000-000000000010",
    category: "boundary",
    severity: "S2",
    severity_reasoning: "A collapsed boundary section leaves the campus open to the adjoining road.",
    rte_entitlement_violated: false,
    estimated_scale: "major",
    location_within_premises: "Eastern boundary",
    status: "submitted",
    age_days: 6,
    resolution_photo_url: null,
  },
  {
    id: "20000000-0000-4000-8000-000000000008",
    code: "LEAK70",
    school_id: "10000000-0000-4000-8000-000000000002",
    category: "structural",
    severity: "S4",
    severity_reasoning: "A roof leak was damaging the classroom learning area during rain.",
    rte_entitlement_violated: false,
    estimated_scale: "minor",
    location_within_premises: "Classroom 1, south-east corner",
    status: "resolved",
    age_days: 70,
    resolved_days_ago: 9,
    resolution_photo_url: "/placeholder/resolution-leak-repaired.jpg",
  },
  {
    id: "20000000-0000-4000-8000-000000000009",
    code: "STAIR54",
    school_id: "10000000-0000-4000-8000-000000000011",
    category: "structural",
    severity: "S2",
    severity_reasoning: "A broken stair edge created a fall hazard on the route to classrooms.",
    rte_entitlement_violated: false,
    estimated_scale: "minor",
    location_within_premises: "Steps to the upper teaching room",
    status: "resolved",
    age_days: 54,
    resolved_days_ago: 4,
    resolution_photo_url: "/placeholder/resolution-stair-repaired.jpg",
  },
];

export const ISSUES: IssueInsert[] = ISSUE_DRAFTS.map((draft) => {
  const school = SCHOOLS.find((candidate) => candidate.id === draft.school_id);

  if (!school) {
    throw new Error(`Missing school for seed issue ${draft.code}`);
  }

  const authorities = deriveAuthorities(
    school.is_urban,
    school.block_name,
    school.district,
    school.name_en,
    draft.estimated_scale,
  );

  return {
    id: draft.id,
    code: draft.code,
    school_id: draft.school_id,
    category: draft.category,
    severity: draft.severity,
    severity_reasoning: draft.severity_reasoning,
    rte_entitlement_violated: draft.rte_entitlement_violated,
    estimated_scale: draft.estimated_scale,
    location_within_premises: draft.location_within_premises,
    ...authorities,
    statutory_limit_days: 90,
    status: draft.status,
    created_at: daysAgo(draft.age_days),
    resolved_at:
      draft.resolved_days_ago === undefined ? null : daysAgo(draft.resolved_days_ago),
    resolution_photo_url: draft.resolution_photo_url,
  };
});

type ReportText = {
  original: string;
  hindi: string;
  english: string;
};

const REPORT_TEXTS: ReportText[] = [
  {
    original: "ನಾಲ್ಕನೇ ತರಗತಿಯ ಮೇಲ್ಛಾವಣಿಯ ಕಂಬ ಕೆಳಗೆ ಬಾಗಿದ್ದು ಅಪಾಯಕಾರಿಯಾಗಿದೆ.",
    hindi: "कक्षा 4 की छत की बीम नीचे झुक गई है और खतरनाक स्थिति में है।",
    english: "The roof beam in Classroom 4 is visibly sagging and presents an immediate safety hazard.",
  },
  {
    original: "ಶಾಲೆಯ ಏಕೈಕ ಕುಡಿಯುವ ನೀರಿನ ನಳ ಕೆಲಸ ಮಾಡುತ್ತಿಲ್ಲ.",
    hindi: "विद्यालय का एकमात्र पेयजल नल काम नहीं कर रहा है।",
    english: "The school's only drinking-water tap is non-functional, leaving pupils without drinking water.",
  },
  {
    original: "ಎರಡನೇ ತರಗತಿಯ ಬಾಗಿಲಿನ ಬಳಿ ತೆರೆದ ವಿದ್ಯುತ್ ತಂತಿ ಇದೆ.",
    hindi: "कक्षा 2 के दरवाज़े के पास खुला बिजली का तार है।",
    english: "An exposed electrical wire is accessible beside the Classroom 2 entrance.",
  },
  {
    original: "ಹೆಣ್ಣು ಮಕ್ಕಳ ಶೌಚಾಲಯದಲ್ಲಿ ನೀರಿನ ವ್ಯವಸ್ಥೆ ಕೆಲಸ ಮಾಡುತ್ತಿಲ್ಲ.",
    hindi: "बालिका शौचालय में पानी की व्यवस्था काम नहीं कर रही है।",
    english: "The water supply in the girls' toilet block is not functioning.",
  },
  {
    original: "ಮುಖ್ಯ ಶಾಲಾ ಕಟ್ಟಡಕ್ಕೆ ವಿಕಲಚೇತನ ಮಕ್ಕಳಿಗಾಗಿ ರ್ಯಾಂಪ್ ಇಲ್ಲ.",
    hindi: "मुख्य विद्यालय भवन में दिव्यांग बच्चों के लिए रैंप नहीं है।",
    english: "The main teaching block does not have an accessible ramp for children with disabilities.",
  },
  {
    original: "ಐದನೇ ತರಗತಿಯ ಹಲವು ಬೆಂಚುಗಳ ಆಸನಗಳು ಮುರಿದಿವೆ.",
    hindi: "कक्षा 5 की कई बेंचों की सीटें टूटी हुई हैं।",
    english: "Several desks in Classroom 5 have broken seats and are not safely usable.",
  },
  {
    original: "ಶಾಲೆಯ ಪೂರ್ವದ ಆವರಣ ಗೋಡೆಯ ಒಂದು ಭಾಗ ಕುಸಿದಿದೆ.",
    hindi: "विद्यालय की पूर्वी चारदीवारी का एक हिस्सा गिर गया है।",
    english: "A section of the eastern boundary wall has collapsed, exposing the campus to the adjoining road.",
  },
  {
    original: "ಮಳೆಯಲ್ಲಿ ಮೊದಲನೇ ತರಗತಿಯ ಮೇಲ್ಛಾವಣಿಯಿಂದ ನೀರು ಸೋರುತ್ತಿತ್ತು.",
    hindi: "बारिश में कक्षा 1 की छत से पानी टपक रहा था।",
    english: "The roof in Classroom 1 was leaking during rainfall and affecting the learning area.",
  },
  {
    original: "ಮೇಲಿನ ಕೊಠಡಿಗೆ ಹೋಗುವ ಮೆಟ್ಟಿಲಿನ ಅಂಚು ಮುರಿದಿತ್ತು.",
    hindi: "ऊपरी कक्षा तक जाने वाली सीढ़ी का किनारा टूटा हुआ था।",
    english: "The edge of a stair leading to the upper teaching room was broken and presented a fall hazard.",
  },
];

export const REPORTS: ReportInsert[] = ISSUE_DRAFTS.map((issue, index) => ({
  id: `30000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  issue_id: issue.id,
  text_original: REPORT_TEXTS[index].original,
  text_hindi: REPORT_TEXTS[index].hindi,
  text_english_official: REPORT_TEXTS[index].english,
  detected_language: "kn",
  photo_url: `/placeholder/issue-${issue.code.toLowerCase()}.jpg`,
  reporter_mode: "anonymous" satisfies ReporterMode,
  reporter_name: null,
  reporter_contact: null,
  capture_provenance: "upload" satisfies CaptureProvenance,
  created_at: daysAgo(issue.age_days),
}));

type EventDraft = {
  issueIndex: number;
  event_type: StatusEventType;
  actor_office: string;
  note: string;
  daysAgo: number;
};

const EVENT_DRAFTS: EventDraft[] = [
  { issueIndex: 0, event_type: "SUBMITTED", actor_office: "Public intake ledger", note: "Anonymous report received and assigned for safety review.", daysAgo: 210 },
  { issueIndex: 0, event_type: "ACKNOWLEDGED", actor_office: "Block Education Office, Hanur", note: "Life-safety complaint acknowledged; head teacher advised to cordon the room and relocate the class as an interim measure.", daysAgo: 208 },
  { issueIndex: 0, event_type: "INSPECTION_ORDERED", actor_office: "District Project Office, Samagra Shiksha", note: "Inspected 14th; structural estimate submitted to DPO, awaiting sanction.", daysAgo: 196 },
  { issueIndex: 0, event_type: "MARKED_UNFUNDED", actor_office: "District Project Office, Samagra Shiksha", note: "Major civil work is not included in the current AWP&B; proposal recorded for the next planning cycle. Interim cordon remains in place.", daysAgo: 181 },
  { issueIndex: 1, event_type: "SUBMITTED", actor_office: "Public intake ledger", note: "Drinking-water failure reported by an anonymous citizen.", daysAgo: 132 },
  { issueIndex: 1, event_type: "ACKNOWLEDGED", actor_office: "Block Education Office, Hanur", note: "Head teacher asked to arrange temporary drinking water while repair is assessed.", daysAgo: 129 },
  { issueIndex: 1, event_type: "INSPECTION_ORDERED", actor_office: "Block Education Office, Hanur", note: "Plumber inspection ordered; replacement tap and damaged supply joint noted.", daysAgo: 121 },
  { issueIndex: 2, event_type: "SUBMITTED", actor_office: "Public intake ledger", note: "Exposed wiring report received for urgent review.", daysAgo: 65 },
  { issueIndex: 2, event_type: "ACKNOWLEDGED", actor_office: "DDPI, Bengaluru Urban", note: "Head teacher instructed to isolate the circuit and keep pupils away as an interim measure.", daysAgo: 64 },
  { issueIndex: 2, event_type: "INSPECTION_ORDERED", actor_office: "DDPI, Bengaluru Urban", note: "Licensed electrician inspection ordered; school grant estimate requested.", daysAgo: 61 },
  { issueIndex: 3, event_type: "SUBMITTED", actor_office: "Public intake ledger", note: "Girls' toilet water-supply failure reported.", daysAgo: 38 },
  { issueIndex: 3, event_type: "ACKNOWLEDGED", actor_office: "DDPI, Bengaluru Urban", note: "Complaint acknowledged and school asked to provide temporary water containers.", daysAgo: 36 },
  { issueIndex: 3, event_type: "INSPECTION_ORDERED", actor_office: "DDPI, Bengaluru Urban", note: "Inspection found a failed inlet valve; repair estimate sent to the School Management Committee.", daysAgo: 31 },
  { issueIndex: 4, event_type: "SUBMITTED", actor_office: "Public intake ledger", note: "Absence of an accessible ramp recorded.", daysAgo: 20 },
  { issueIndex: 4, event_type: "ACKNOWLEDGED", actor_office: "DDPI, Bengaluru Urban", note: "Accessibility complaint acknowledged and site measurements requested.", daysAgo: 18 },
  { issueIndex: 4, event_type: "INSPECTION_ORDERED", actor_office: "District Project Office, Samagra Shiksha", note: "Engineering visit ordered to prepare a compliant ramp design and civil-works estimate.", daysAgo: 12 },
  { issueIndex: 5, event_type: "SUBMITTED", actor_office: "Public intake ledger", note: "Broken classroom desks reported for verification.", daysAgo: 2 },
  { issueIndex: 6, event_type: "SUBMITTED", actor_office: "Public intake ledger", note: "Collapsed boundary section reported beside the eastern road.", daysAgo: 6 },
  { issueIndex: 7, event_type: "SUBMITTED", actor_office: "Public intake ledger", note: "Classroom roof leak reported.", daysAgo: 70 },
  { issueIndex: 7, event_type: "ACKNOWLEDGED", actor_office: "DDPI, Bengaluru Urban", note: "School asked to protect books and move pupils away from the wet corner.", daysAgo: 68 },
  { issueIndex: 7, event_type: "INSPECTION_ORDERED", actor_office: "DDPI, Bengaluru Urban", note: "Inspection confirmed displaced roof tiles; repair approved from the composite grant.", daysAgo: 57 },
  { issueIndex: 7, event_type: "RESOLVED", actor_office: "School Management Committee", note: "Roof tiles replaced and the repaired area checked after rainfall; after-photo attached.", daysAgo: 9 },
  { issueIndex: 8, event_type: "SUBMITTED", actor_office: "Public intake ledger", note: "Broken stair edge reported.", daysAgo: 54 },
  { issueIndex: 8, event_type: "ACKNOWLEDGED", actor_office: "Block Education Office, Hanur", note: "Head teacher asked to restrict the stair until repair.", daysAgo: 52 },
  { issueIndex: 8, event_type: "INSPECTION_ORDERED", actor_office: "Block Education Office, Hanur", note: "Mason inspected the step; minor repair approved from the composite grant.", daysAgo: 45 },
  { issueIndex: 8, event_type: "RESOLVED", actor_office: "School Management Committee", note: "Damaged stair edge rebuilt and cured; access reopened after inspection and after-photo attached.", daysAgo: 4 },
];

export const STATUS_EVENTS: StatusEventInsert[] = EVENT_DRAFTS.map((event, index) => ({
  id: `40000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  issue_id: ISSUE_DRAFTS[event.issueIndex].id,
  event_type: event.event_type,
  actor_office: event.actor_office,
  note: event.note,
  created_at: daysAgo(event.daysAgo),
}));

export const SEED_DATA = {
  schools: SCHOOLS,
  issues: ISSUES,
  reports: REPORTS,
  status_events: STATUS_EVENTS,
} as const;
