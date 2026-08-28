# Build log

## 1. Method

`AGENTS.md` and `SPEC.md` were prepared before implementation prompts began, and Codex read both automatically before working. Work proceeded as numbered vertical slices. Each slice was intended to end in a browser-verifiable acceptance test and its own commit.

The current Git history does not preserve a perfect one-prompt/one-commit mapping. Some slices were split across corrective commits, and the AI-processing and submission work was committed together. The mappings below report the history as it exists rather than assigning invented hashes.

## 2. Prompt sequence

### Prompt A — Project foundation

- Asked: Set up the Next.js App Router project in TypeScript, configure Tailwind CSS, define the colour system, and add the initial layout and About page.
- Codex produced: The application scaffold, root layout, initial pages, documentation, and Tailwind v4 CSS-first theme tokens.
- Commits:
  - `29a8b2389bf257959cde3ca3e870da792a051ce8` — Prompt A: scaffold, colour tokens, about page
  - `24c67a066727e9db007c40b898eab17ddfa55e21` — Tailwind v4 theme tokens

### Prompt B — Database, seed data, and data access

- Asked: Create the Supabase schema and policies, enforce an append-only status ledger, add fictional Karnataka seed data, implement deterministic authority routing, and make seeding repeatable.
- Codex produced: The four-table migration, RLS policies, append-only triggers, seed dataset, authority functions, typed Supabase client, and idempotent reset path.
- Commits:
  - `9f4f47d06857580b641edced47b470feac4319a9` — Prompt B1: schema, RLS, append-only trigger
  - `d7b3d29482993628a610a8e1c79e08d134e742e4` — Prompt B2: seed data, authority mapping, db client
  - `fe64b3421446586d66111d9a4688ce43aae20420` — Prompt B: seed data, idempotent reset, unfunded status

### Prompt C — Local block home page

- Asked: Resolve the nearest block from browser location, allow manual block selection, and show schools and open issues ordered by severity and age.
- Codex produced: The geolocated block view, block picker, severity summary, issue cards, unfunded treatment, shared layout, and prototype notice.
- Commit: `e67aee381c27a5b52639e3f96710cf342b2dfb95` — Prompt C: home page, block resolution, layout

### Prompt D — Citizen report flow

- Asked: Build the three-step photo, school, and description flow with revisitable state, camera capture, school search, and voice recording.
- Codex produced: A shared report context, shared location context, three-step mobile form, photo preview, school shortlist and search, MediaRecorder capture, review screen, and persistent report entry points.
- Commits:
  - `e090f344f2ac10f64feb728462d6aaa738d576a0` — Prompt D: report flow, three steps, shared location context
  - `109af78a590020f2e13f8a59b08ea5beb8aab616` — Prompt D: report flow, three steps, shared location context

### Prompt E — Photo privacy and school-signboard detection

- Asked: Add fail-closed face redaction, move it into the background, add an in-memory server fallback, support multiple defect photos, and identify schools from an optional signboard photo.
- Codex produced: A MediaPipe worker, on-device and server redaction paths, manual fallback, concurrent multi-photo handling, signboard extraction and fuzzy matching, diagnostic failure reasons, and the initial known-issues record.
- Commits:
  - `4137929f662f195dd9b0a80f1e7943d3535e9547` — trial for face
  - `c1e24a9be13adea8daa7a89420640e4222c08b67` — Multi-photo capture, signboard school detection, schema update
  - `af4dfe8d8b673d859bc7571a6a0e9ffb1979e978` — trial of face redaction
  - `39d8c9827cc8ea99f047f6a2aefe2def2db2e202` — partial complete Prompt E. Known issues created

### Prompt F — AI report processing

- Asked: Transcribe optional audio, classify and translate the report into strict structured data, validate it, and derive authorities with deterministic code.
- Codex produced: `process-report.ts`, transcription and classification calls, strict structured output validation, retry handling, latency logging, and deterministic routing.
- Commit: `39774cd12a701f47a567c5bdd707e197cbec8845` — Work in progress explanatory panel

  The commit subject does not describe all of its contents; the diff also introduced the report-processing action.

### Prompt G — Submission, duplicate handling, and receipt

- Asked: Connect report processing to the review screen, upload redacted photos, persist reports and status events, offer explicit duplicate corroboration, and issue a dignified receipt.
- Codex produced: Staged processing feedback, Supabase Storage persistence, six-character complaint codes, duplicate choices, idempotent submission handling, the receipt route, and copyable complaint codes.
- Commit: `39774cd12a701f47a567c5bdd707e197cbec8845` — Work in progress explanatory panel

  Prompt F and Prompt G share this commit in the recorded history.

### Prompt H — Public issue record

- Asked: Build the public issue page with photos, provisional severity, both responsible authorities, funding pathway, unfunded state, append-only timeline, statutory clock, and reopening.
- Codex produced: `/issue/[code]`, the one-second statutory clock, public history, authority presentation, custom not-found state, after-photo display, and append-only `REOPENED` action.
- Commit: `7467a5fffcdad38c3a3dba67294ec477b9e5f7c7` — Prompt H: public issue page, statutory clock, reopen action

### Prompt I — Seed illustrations and anonymous tracking

- Asked: Replace broken seed-photo boxes with clearly illustrative assets and add complaint-code tracking.
- Codex produced: Flat SVG illustrations labelled as seed data, repaired-state illustrations, `/track`, code normalization, and removal of the unfinished marker from tracking.
- Commit: `c9b35f8e794fe5f2f756c4ff657c17fdbf1c22bc` — seed illutraions, track by code

### Prompt J — Department duty view

- Asked: Build the simulated block department queue, append officer actions and notes, require funding reasons and resolution photos, and show the office its own response record.
- Codex produced: `/dept/[blockId]`, the simulation warning, severity-and-age queue, acknowledgement, inspection, unfunded and resolution actions, response metrics, and the About-page demonstration link.
- Commit: `9fba656981ae4dc7f5e53a1baffa4167dc6db7f8` — Prompt J: department view with append-only actions

### Prompt K — Trilingual interface

- Asked: Add English, Hindi, and Kannada selection, persist it, render the matching issue text, set the document language, and self-host the required script fonts.
- Codex produced: The language switcher, local preference and server-rendering bridge, language-specific issue rendering, dynamic `<html lang>`, and self-hosted Noto Sans Devanagari and Kannada subsets.
- Commit: `5c5d720029954e083094c74f9a2076ea1337e0be` — Prompt K: trilingual toggle, self-hosted Noto subsets

## 3. Where Codex went beyond the prompt

- It moved geolocation into a shared React context so the home page and report flow use the same resolved location instead of asking twice.
- It applied the face-redaction control to an officer's resolution after-photo before storage, not only to citizen report photos.
- It added a statement-level append-only trigger as well as the row-level trigger, covering `TRUNCATE` and statements that match no rows.
- It chose a Web Worker for MediaPipe detection so model initialization and face detection do not occupy the main interface thread.

## 4. Where I caught Codex

- Server redaction initially reported success while returning an effectively unredacted image. Sharp had collapsed a lazy `resize(small).resize(large)` pipeline, so the pixelated patch was byte-identical to the source patch even while the UI said faces were hidden. The fix materialized the downscaled patch with `toBuffer()`, created a new Sharp instance for nearest-neighbour upscaling, and added a SHA-256 comparison. An unchanged patch now throws and fails closed.
- One model-generated face box covered about 46% of the frame. It was not a tight face box and would have obscured much of the reported defect. The prompt was tightened to request hairline-to-chin and ear-to-ear bounds, padding was reduced, and any box above the area threshold is retried once and then rejected to manual redaction.
- The first redaction interface stopped the citizen during Step 1 and made privacy processing their task. Testing the flow as a citizen showed that this was the wrong interaction. Redaction was moved into the background while the citizen completes the school and description steps. Its result is shown at review, and only failure of both automatic paths exposes the manual tool.

## 5. Diagnostics

Codex measured the MediaPipe WASM binary at 11.76 MB and a 13-second cold download. That result changed the design: raising the original eight-second timeout would not make the experience acceptable on a mid-range Android phone over rural mobile data. The detector is now warmed once per session and kept as the preferred on-device path, while server-side redaction became the primary reliable fallback. Manual redaction remains the final fail-closed path when both automatic approaches fail.
