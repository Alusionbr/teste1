---
name: estante-maintenance
description: Diagnose, test, and publish fixes to the Estante song-search, lyrics, offline, and rehearsal app in this repository.
---

# Estante maintenance

Work only in `estante/` unless a failure demonstrably crosses the repository boundary. The deployed app is `https://alusionbr.github.io/teste1/estante/`; GitHub Pages publishes `main` through `.github/workflows/pages.yml`.

For lyric failures, separate catalog discovery from lyric retrieval: Deezer, Apple, and MusicBrainz identify recordings but do not return text. Trace `search-ui.js` → `search-engine.js` → `core.js` providers → `player.js`. Run `node estante/scripts/check-sources.mjs` before attributing a failure to code; it reports provider health and the deployed version without printing lyrics. A 503 from Vagalume affects Brasil and Trecho; Brasil can switch to Inteligente, while Trecho cannot search remote verse text through the other providers. Preserve exact title/artist checks when accepting lyrics and label a reconstructed medley as an ensaio version.

When changing the app shell, bump the same version in `core.js`, `sw.js`, and every `?v=` reference in `index.html`. Navigation must use network-first with the cached HTML as the offline fallback; register the worker with `updateViaCache: "none"` and request `reg.update()` after installing update listeners. These keep returning users from being stuck on an old page. Run `node --test estante/tests/*.test.js` and `node estante/tests/browser-smoke.js` with a local HTTP server on port 8765. Set `ESTANTE_LIVE_LYRICS=1` only when an external-provider check is relevant. Inspect the final diff and verify the deployed HTML version after GitHub Pages succeeds.

Do not assume a pushed PR is live: this repository publishes only after integration into `main`. Check the Pages workflow result and the live version before reporting completion.

For account and cloud work, use `estante/account.js` (session transitions, upload/download/conflicts), `cloud-model.js` (validated payload/hash), `storage.js` (separate guest/account namespaces and recovery copy), `telemetry.js` (aggregate activity pulses without session IDs), and `supabase/functions/estante-usage/index.ts` (validated server ingestion). The shared Supabase project is `pxqhpntifbtjaoqtirao`; only `estante_*` objects may be changed. Never put a secret or service-role key in browser assets. Keep aggregate usage counters in the admin panel only; never collect device or browser fingerprints. RLS must prevent users from reading others' usage and workspaces. Run the transactional `estante/supabase/tests/access.sql` without retaining fixture users. Account live test needs disposable fixture users and `estante/test-results/credentials.json` (ignored). Check SMTP and the Auth redirect allowlist before announcing new signup or password recovery. The deployed build vendors a pinned supabase-js bundle at `estante/vendor/supabase.js`; regenerate it only on dependency changes.
