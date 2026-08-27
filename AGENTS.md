# AGENTS.md

Read `SPEC.md` before any task. When a prompt references a section like "SPEC.md §4", that
section is authoritative — follow it exactly rather than improvising.

## Project

ThikHua — a public accountability ledger for government school infrastructure repair in India.
Next.js 14 App Router · TypeScript · Tailwind · Supabase · OpenAI API · deployed on Vercel.

This is a 48-hour hackathon prototype. **Working and honest beats complete.**

## Working style

- Do exactly what the prompt asks. Do not add features, routes, or abstractions that were not requested.
- One vertical slice per task, ending in something visible in a browser.
- Never refactor working code unless explicitly asked.
- When fixing an error, change only what causes that error.
- Prefer boring, obvious code over clever code. This will be read by a reviewer under time pressure.

## Next.js version

This project uses a Next.js version with breaking changes from older releases.
Before writing ANY Next.js code — routing, layouts, params, server actions,
data fetching, metadata — read the relevant guide in
`node_modules/next/dist/docs/`. Do not rely on Next.js patterns from memory.
If a pattern you were about to use is deprecated there, use the documented
replacement and tell me what changed.

## Hard rules

1. **`status_events` is append-only.** Never write an update or delete against that table.
   Corrections are new events.
2. **On-device photo redaction is attempted first and preferred.** Server-side redaction is
   the fallback. The unprocessed image is held in memory only and never written to storage;
   only the redacted image may be persisted.
3. **Face blurring fails closed.** If on-device detection fails or times out, try the
   in-memory server fallback; if that also fails, require manual redaction. Never silently
   accept an unredacted photo.
4. **Authority derivation is deterministic code**, per SPEC.md §4. Never ask an AI model to
   decide which office is responsible.
5. **All schools in seed data are fictional.** Never use a real school name attached to a
   defect allegation.
6. **Check current OpenAI model names in the official docs.** Do not use a model name from
   memory.
7. Anonymous reporting must work end to end — no route in the citizen journey may require an
   account.

## Code conventions

- Server actions over API routes where possible.
- Supabase JS client directly at `lib/db.ts`. No ORM.
- Zod for validating anything crossing a boundary, especially AI output.
- Colour only via the CSS custom properties in SPEC.md §8. No hardcoded hex in components.
- No icon libraries. Inline SVG only — page weight budget is 150 KB.
- No `localStorage` except the language preference.
- All user-facing strings go through `lib/i18n.ts`. Never hardcode English in a component.

## Accessibility and performance

- Mobile-first. Must work at 360px.
- Honour `prefers-reduced-motion` for every animation, including the elapsed clock.
- Body text is charcoal-on-sand or sand-on-indigo only. Mid-tones are fills and borders.
- No animation loop that runs per-row in a list. The ticking clock renders on the issue
  detail page only, at 1-second resolution.

## Definition of done

A task is done when the stated acceptance test in the prompt passes in a browser — not when
the code compiles. If you cannot make the acceptance test pass, say so plainly rather than
reporting success.
