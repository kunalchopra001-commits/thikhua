# Known issues — Stage 1

1. Gallery uploads sometimes fall through to manual redaction with a
   network-level "fetch failed" on the server path. Camera captures work
   reliably. Suspected large-image timeout. No retry logic yet.

2. Signboard extraction returns no text intermittently. The fuzzy matcher is
   confirmed working (scored 0.846 against a 0.45 threshold), so the failure is
   in extraction or upstream redaction, not matching.

3. HEIC images can fail at createImageBitmap() and fall through to manual
   redaction.

4. Anonymous INSERT on status_events is open in RLS, so a public actor could
   post a fake status event. Acceptable for a prototype; must be fixed before
   any real deployment.

5. Server-side redaction sends the unprocessed image off-device. On-device is
   attempted first; the image is held in memory only and never persisted
   unprocessed.

6. gpt-5-nano bounding-box accuracy is unverified across a range of face sizes
   and angles.