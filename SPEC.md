# ThikHua — Build Spec

Public accountability ledger for government school infrastructure repair.
Stage 1 prototype. Karnataka only. Fictional schools.

---

## 1. The problem this solves

A citizen reports a broken or unsafe facility at a government school and never learns whether
it reached anyone, who is answerable, or what happened next.

The deeper finding: **the office that receives a complaint is generally not the office
empowered to fix it.** Grievance sits with the Block/District Education Officer under the RTE
Act. Funding and execution sit with a structurally separate Samagra Shiksha state
implementation society, split again by cost — the school's own composite grant for minor work,
an external agency (PWD/contractor) for civil works above ₹30 lakh — and gated by an annual
Work Plan & Budget cycle.

So a genuinely unsafe ceiling can be correctly reported, correctly received, and still be
structurally unfixable this financial year. **No existing system makes that visible.**

The product's distinctive output is not "your complaint was routed" but "here is who must hear
you, here is who must act, here is the funding pathway, and here is where it is stuck."

---

## 2. Non-negotiables

1. No real school is named with a real defect allegation. All seed schools are fictional.
2. No child's face may ever be uploaded. Blurring is client-side and fails closed.
3. `status_events` is append-only. Nothing in the codebase may update or delete a row.
4. Anonymous reporting must support full follow-up via complaint code.
5. Every mocked dependency is labelled in the UI.
6. Works on a 360px viewport over a throttled connection.

---

## 3. Data model

```
schools
  id, udise_code (fictional), name_en, name_kn, block_id, block_name,
  district, state, is_urban (bool), management_type,
  lat, lng, enrolment

issues
  id, code (6-char), school_id, category, severity (S1|S2|S3|S4),
  severity_reasoning, rte_entitlement_violated (bool),
  estimated_scale (minor|major), location_within_premises,
  grievance_authority, execution_authority, funding_pathway,
  statutory_limit_days, status, created_at, resolved_at,
  resolution_photo_url

reports
  id, issue_id, text_original, text_hindi, text_english_official,
  detected_language, photo_url, reporter_mode (anonymous|named_private|named_public),
  reporter_name (nullable), reporter_contact (nullable),
  capture_provenance (live|upload), created_at

status_events            -- APPEND ONLY
  id, issue_id, event_type, actor_office, note, created_at
```

`event_type`: `SUBMITTED | CORROBORATED | ACKNOWLEDGED | INSPECTION_ORDERED |
MARKED_UNFUNDED | RESOLVED | REOPENED`

Blocks are derived from schools, not a separate table. Block centroids live in the seed file.

---

## 4. Authority mapping (deterministic — not an AI call)

```
grievance_authority:
  rural → "Block Education Officer, <block> Block"
  urban → "Deputy Director of Public Instruction, <district> (Urban)"

execution_authority:
  scale = minor → "School Management Committee, <school> (Composite School Grant)"
  scale = major → "Executive Engineer, PWD <district> Division
                   (via District Project Office, Samagra Shiksha)"

funding_pathway:
  minor → "Composite School Grant — school-level, current financial year"
  major → "Civil works above ₹30 lakh — external agency; requires inclusion in
           the Annual Work Plan & Budget (AWP&B)"

statutory_limit_days:
  always 90   -- RTE Act, three months, Section 32(1)
```

For S1 issues, additionally surface an **interim make-safe recommendation** — cordon the room,
relocate the class, isolate the circuit — attributed to the head teacher's own authority, and
label it clearly as an interim measure, not the repair.

---

## 5. Screens

### 5.1 Home — local block
Geolocate → nearest block by centroid → show that block only. Denied/unavailable → block
picker. Header: block name, school count, issue counts by severity. Body: open issues as
cards (school, one-line defect, severity chip, days elapsed). Never open on a national map.
Show the block view even when it has zero issues, with a "be the first to check your school"
empty state.

### 5.2 Report flow
Step 1 photo → Step 2 school → Step 3 describe. State in one React context, steps revisitable.
Step 2 shortlists 5 nearest schools as tappable cards + manual search. Never auto-select.
Step 3 offers text and MediaRecorder voice, in any language.

### 5.3 Duplicate check
Before submit: if open issues exist at this school in the same category, show them. User either
corroborates (creates a `report` on the existing issue + a `CORROBORATED` event) or proceeds
with a new issue.

### 5.4 Receipt
Inline SVG line-art folded hands, indigo on sand, 600ms entry, `prefers-reduced-motion`
respected. "जय हिंद" in the selected language. Complaint code — large, monospace,
copy-to-clipboard. The receiving office by name. The date they must respond by.
Register: dignified receipt, not celebration.

### 5.5 Public issue page — `/issue/[code]`
Public, no auth. School + block. Defect in the viewer's language. Blurred photo. Severity chip
with reasoning. **Both** authorities named, plus funding pathway. Append-only timeline with
dated events and officer notes. If resolved: after-photo + a "this is not fixed" button that
appends `REOPENED`.

### 5.6 The clock
1-second resolution, **not** milliseconds. Only on the issue detail page — lists show plain
"213 days". Large, monospace, shown against the statutory limit:
`Day 213 · Statutory limit under RTE: 90 days`.
Colour: sand → ochre (day 45) → terracotta (day 90) → rani pink (day 180).
`prefers-reduced-motion` renders a static value.

### 5.7 Department view — `/dept/[blockId]`
Mock-auth by URL, visibly labelled. Header: "आपकी निगरानी में — N विद्यालय, M बच्चे".
Queue sorted by severity then age. Four working actions, each appending a status event with a
free-text note: Acknowledge · Order Inspection · Mark Unfunded (reason required: not in current
AWP&B / awaiting sanction / exceeds grant limit) · Resolve (after-photo required).
Frame as duty and care, never accusation. This view is secondary — reviewers test the citizen
experience.

---

## 6. Face blurring

Client-side, fail-closed. MediaPipe Tasks Vision `FaceDetector` from CDN. Detect → draw to
canvas → heavy blur over each face region → rasterise. **Only the blurred canvas output is
uploaded.** Show a before/after toggle and a blurred-face count.

Detector load failure or 8-second timeout → manual redaction fallback (drag rectangles, same
canvas blur). Never silently accept an unblurred photo.

Legal basis: under the DPDP Act any identifiable child is a child data subject, and the
educational-institution exemption does not extend to this platform. This is a legal control,
not a UX nicety.

---

## 7. AI pipeline

### 7.1 Shape
Server action. Audio → transcription API. Text → chat model → strict JSON. Parse defensively:
strip fences, validate with Zod, retry once with a stricter instruction on failure.
Authority derivation is deterministic code, never an AI call.
Check current model names in the OpenAI docs — do not rely on memory.

### 7.2 System prompt

> You are processing a citizen's report about a government school building in India.
>
> Return ONLY a JSON object. No markdown, no code fences, no preamble.
>
> Fields:
> - `detected_language`: BCP-47 tag of the input.
> - `text_original`: the report verbatim in its original language.
> - `text_hindi`: a faithful Hindi rendering.
> - `text_english_official`: rewritten in formal English suitable for an official
>   municipal/education-department complaint. Factual, specific, no emotive language.
> - `category`: one of `structural`, `electrical`, `sanitation`, `water`, `furniture`,
>   `accessibility`, `boundary`, `other`.
> - `severity`: one of `S1`, `S2`, `S3`, `S4`.
>   - S1 — danger to life: unstable ceiling or beam, cracked load-bearing wall, exposed live
>     wiring, unfenced well or tank.
>   - S2 — health and safety: no drinking water, non-functional toilets, unsafe stairs,
>     kitchen hazard.
>   - S3 — entitlement violation under the RTE Act: no CWSN ramp, no separate girls' toilet,
>     no electricity.
>   - S4 — learning environment: broken furniture, leaking roof, blackboard, windows.
> - `severity_reasoning`: one sentence naming the concrete indicator that set the tier.
> - `rte_entitlement_violated`: boolean.
> - `estimated_scale`: `minor` if plausibly within a school-level maintenance grant;
>   `major` if it needs structural or civil work by an external agency.
> - `location_within_premises`: e.g. "Room 3, north wall", or null if not stated.
>
> Never invent details the reporter did not give. If severity is ambiguous, choose the lower
> tier and say so in the reasoning. Severity is provisional until inspected.

---

## 8. Visual system

| Token | Hex | Use |
|---|---|---|
| `--sand` | `#F5EFE3` | Base surface |
| `--charcoal` | `#2E2A26` | Body text |
| `--indigo` | `#1F3A5F` | Primary structure, headers |
| `--rani` | `#C2185B` | Decision points, critical state |
| `--terracotta` | `#B5622F` | Warning state |
| `--green` | `#3F6B4F` | Resolved |
| `--stone` | `#8C8C84` | Muted, inactive |
| `--ochre` | `#D4A537` | Highlight, first threshold |

**Discipline:** earth tones carry the structure; indigo and rani appear only at decision
points. A page where everything is pink reads as festival.

**Contrast:** terracotta on sand fails WCAG AA for body text. Mid-tones are for fills and
borders only. Text is charcoal-on-sand or sand-on-indigo.

**Motifs, structural not decorative:** Ajrakh block-print geometry as section dividers and
card borders (inline SVG, tileable). Kolam dot-grid as background lattice on empty states.
Severity chips in ochre/terracotta/rani — never a red/amber/green traffic light.

**Type:** Noto Sans Devanagari + Noto Sans Kannada + Latin, subsetted, self-hosted,
`font-display: swap`. System-fallback rendering of Indian scripts looks broken and would
undermine the trilingual claim.

**Register:** civic-patriotic, never party-coded. "Jai Hind" is a standard official and
armed-forces sign-off and reads as broadly national. No heavy tricolour saturation, no slogans,
no campaign-adjacent iconography — political neutrality is what makes this usable *by* a
department rather than only against one.

**Budget:** total page weight under 150 KB excluding user photos. No photo carousels, no
icon libraries, no analytics.

---

## 9. Seed data

Karnataka. Two blocks: one urban (Bengaluru), one rural. 12 fictional schools.
9 issues: 2 resolved with after-photos, 3 in progress, 2 past the 90-day statutory limit,
2 fresh. Mixed severity, with at least one S1 marked `major` scale and `MARKED_UNFUNDED` —
that record is the demo's centrepiece, because it shows a life-safety hazard that is
structurally unfixable this financial year.

Each issue needs a plausible `status_events` history with realistic officer notes
("Inspected 14th, estimate submitted to DPO, awaiting sanction").

---

## 10. `/about` — honesty page

**Works today:** trilingual capture and rendering, client-side face blurring, severity
triage, school identification, dual-authority routing, duplicate detection at intake,
append-only public ledger, anonymous tracking by code.

**Mocked:** department accounts and authentication; submission into government systems;
school registry (fictional schools, real jurisdiction structure); the department view is
simulated with no real authorisation.

**At scale:** key off real UDISE codes; use India Post DIGIPIN for location; mirror rather
than replace official channels by generating correctly formatted complaints for CPGRAMS or
state portals and tracking those reference numbers alongside; publish an open read API.

**Retention:** raw photos with EXIF are never stored — stripped and blurred client-side.
Precise coordinates downgrade to block-level after school confirmation. Reporter contact is
erased once the issue closes plus an appeal window. The permanent public record contains no
personal data — only institutional facts.
