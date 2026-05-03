# How to inject the upgraded `scenario-gen` system prompt

This system prompt is a drop-in replacement for `SERVICE_PROMPTS['scenario-gen']` in `Q/lib/ai-engine.ts`. It keeps the existing JSON output shape so the UI, event bus, and JSON repair logic continue to work without changes.

## Why it's better than the current prompt

The current prompt (≈35 lines) tells the LLM to produce 3 scenarios per requirement with the right shape. The upgraded prompt (≈170 lines) adds:

- **Document intake discipline** — extract metadata, FSD references, field tables, master LOVs, integrations, regulatory anchors before writing any scenario.
- **Field-level derivation rules** — every Mandatory field gets a negative-empty test; every Min/Max length gets a boundary pair; every dropdown gets a "value not in master" negative.
- **Workflow derivation rules** — every N-level approval flow gets N approve cases, N reject cases, role-bypass negatives, and SLA-breach edge cases.
- **Integration derivation rules** — every external system reference (T24, ICPR, Dukcapil, Pefindo, PBK, Peruri, e-materai) gets happy-path, down/timeout, and partial-response cases.
- **POJK-aware threshold testing** — Rp 50M / 500M / 1B plafon brackets per POJK 11/2025 are explicitly listed so the LLM produces the boundary-pair tests around each bracket.
- **Domain examples baked in** — Bahasa Indonesia field names, NIK 16 digits, NPWP rules, JaGuarS workflow vocabulary (Maker → Checker → Approver → Pemutus, Risk Officer, Compliance Officer).
- **Self-rejection quality gate** — the LLM checks its own draft against 11 rejection criteria before emitting.
- **Backward-compatible** — output schema (`scenarios[]` + `summary`) and testType enum (`Positive | Negative | Edge Case`) are unchanged.

## Step-by-step injection

### Option A — Minimal change (recommended)

Edit `Q/lib/ai-engine.ts` and import the constant.

```ts
// At the top of Q/lib/ai-engine.ts, add the import
import { SCENARIO_GEN_SYSTEM_PROMPT } from './prompts/scenario-gen-prompt';

// Replace the existing 'scenario-gen' value in SERVICE_PROMPTS (around line 205):
const SERVICE_PROMPTS: Record<string, string> = {
  'scenario-gen': SCENARIO_GEN_SYSTEM_PROMPT,
  'traceability': /* ... existing ... */,
  // ...
};
```

That's the entire patch. The route (`Q/app/api/scenario-gen/route.ts`) and UI (`Q/app/application/scenario-generator/page.tsx`) need zero changes.

### Option B — Inline replacement

If you'd rather not add a new file, copy the body of `SCENARIO_GEN_SYSTEM_PROMPT` from `scenario-gen-prompt.ts` and paste it in place of the existing template literal at line 205 of `ai-engine.ts`.

### Option C — Extended schema (not backward compatible)

If you want the LLM to emit richer test types (`Boundary`, `Security`, `Integration`, `UI`, `Performance`), swap to `SCENARIO_GEN_SYSTEM_PROMPT_EXTENDED` and update:

1. The TypeScript type for the scenario shape (currently inferred from the prompt).
2. The UI rendering in `Q/app/application/scenario-generator/page.tsx` to display the new types.
3. The `summary` consumer in `Q/app/api/scenario-gen/route.ts` (line 32) — it currently reads `summary.total`, but if you display per-type counts you'll want to read the new fields.
4. The mock fallback `generateTestScenarios()` in `ai-engine.ts` (line 711) so the dev/no-LLM path still produces consistent shapes.

## Validating after injection

1. Build the app — TypeScript will fail if the import path is wrong:
   ```bash
   cd Q && npm run build
   ```
2. Run the scenario generator with the Jamkrindo FSD as a regression input:
   - Upload `jamkrindo/FSD Registrasi CIF dan Penjaminan Cash Loan.docx` to the QAQC4BI scenario-generator page.
   - Expect ≥ 30 scenarios that reference the actual chapters (1.2, 9.3.1, 10.2, etc.) and POJK 11/2025 plafon brackets.
   - Expect every Mandatory field in tables (NIK, Nama, Tgl Lahir, Alamat, Plafon) to appear in at least one Negative empty-field scenario.
   - Expect at least one Edge Case scenario at each POJK bracket boundary (50M, 500M, 1B).
3. Compare against the gold-standard `test_cases_FSD_Registrasi_CIF_Penjaminan.xlsx` in `Q/jamkrindo/` — the LLM-generated output should overlap heavily with the 144 manually authored test cases.

## Tuning knobs (pass via `body.options` from the UI)

These don't need prompt changes — they can be appended in the user message in `route.ts` if you want to expose them:

```ts
// In route.ts, append to the user prompt:
const tuning = body.options?.tuning ?? '';
// Examples of tuning strings the user can pass:
//   "Limit to top 10 priority test cases per module."
//   "Bias toward negative and security cases at a 60/40 ratio."
//   "Emit only Critical-priority Positive happy paths, max 1 per sub-module."
//   "Generate at least 3 boundary test cases per numeric/date/length field."
```

## Test the prompt against any FSD

The prompt is domain-aware (Jamkrindo / payment / guarantee) but generalizes to any spec. Try it against:

- `Q/jamkrindo/FSD - Klaim dan Subrogasi Cash Loan V.1.0.docx` — expect scenarios for klaim flow, subrogasi, recovery.
- `Q/jamkrindo/FSD Master Data dan Konfigurasi CashLoan.docx` — expect master data CRUD, PKS configuration, field-level admin.
- `Q/jamkrindo/3. FSD-Aplikasi Integrasi ke Oracle sprint 1_ 26-08-2024.pdf` — expect integration scenarios, batch sync, error replay.

Each should yield richer, traceable scenarios than the current prompt produces.

## Reverting

The old prompt is preserved in git history. To revert, just remove the import and restore the original template literal at line 205 of `ai-engine.ts`.
