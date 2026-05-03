# QAQC4BI Demo — 3-Persona Walkthrough

A short scripted demo showing how three roles use QAQC4BI together to ship a feature with full QA/QC coverage.

## Credentials

All seeded automatically in `data/users.json` on first run.
Sessions are signed cookies (HMAC-SHA256), 8-hour TTL.

| Role          | Username | Password    | Persona                                   |
|---------------|----------|-------------|-------------------------------------------|
| QA Leader     | `leader` | `leader123` | **Sarah Wijaya** — owns QA strategy       |
| QC Analyst    | `qc`     | `qc123`     | **Budi Santoso** — validates pipelines    |
| Tester        | `tester` | `test123`   | **Diana Putri** — generates & runs tests  |

> Click any persona card on `/login` to auto-fill and sign in instantly.

---

## Demo scenario — "Cash Loan Penjaminan release, sprint 24"

The Jamkrindo team is shipping the **CIF Registration & Penjaminan Cash Loan** feature. Each persona contributes a piece of the QA/QC pipeline.

### Step 1 — Sarah (QA Leader) plans the sprint

1. Sign in as `leader` / `leader123`.
2. Lands on **Executive Dashboard** — checks open defects, automation pass rate, and QA velocity for sprint 24.
3. Opens **AI Settings** to confirm the team is on **DeepSeek-V3** (cost-efficient for high-volume scenario generation this sprint).
4. Drops the FSD into a shared folder for Diana, then signs out.

> **What Sarah cares about:** roll-up dashboards, model/cost choice, sign-off readiness.

### Step 2 — Diana (Tester) generates test scenarios

1. Sign in as `tester` / `test123`.
2. Goes to **Application → Test Scenario Generator**.
3. Uploads `FSD Registrasi CIF dan Penjaminan Cash Loan.docx`.
4. Picks **DeepSeek-V3** in the provider dropdown (matching Sarah's choice).
5. Clicks **Identify Modules** — 12 modules detected (Registrasi CIF, NIK validation, Plafon limit per POJK 11/2025, Penjaminan submission, Maker/Checker/Approver, e-materai, Peruri integration, Dukcapil, Pefindo CB, T24 sync, ICPR, Reporting).
6. Unticks "Reporting" (deferred to sprint 25), clicks **Generate Selected (11)**.
7. Watches the table fill in module-by-module — 110 scenarios across 11 modules with FR mapping, priority, steps, expected results.
8. Exports to Excel for review.
9. Goes to **Application → Automation Code Generator**, pastes the Critical-priority scenarios, picks Selenium → gets Page-Object code skeletons.

> **What Diana cares about:** speed (no manual writing), traceability (FR + REQ IDs auto-mapped), variety (positive/negative/edge per module).

### Step 3 — Budi (QC Analyst) validates the data layer

> **Dummy data files** for this step live in `samples/demo-jamkrindo/` — drop them into the corresponding pages.

1. Sign in as `qc` / `qc123`.
2. Goes to **Data Analytics → Data Quality Profiler** → uploads **`samples/demo-jamkrindo/cif_registrations.csv`** (25 rows). Finds 3 NULL `nik` values (Critical, rows 3/9/15) and 16 NPWP format violations (Major — legacy hyphen format).
3. Opens **ETL/Pipeline Validator** → uploads **`samples/demo-jamkrindo/pipeline-validation-config.json`** + **`penjaminan-pipeline-log.txt`**. Spots row-count mismatch at stage `03_pefindo_credit_bureau_enrich` (expected 22, actual 18, missing 4 CIFs).
4. Opens **Defects → Intelligent Defect Classifier** → pastes **`samples/demo-jamkrindo/defect-pefindo-timeout.txt`** → AI classifies as `Data Integrity / Pefindo / High`, suggests retry + circuit breaker + DLQ.
5. Opens **Defects → Defect Pattern Analyzer** → loads **`samples/demo-jamkrindo/defect-history-sprint22-24.csv`** → pattern `pefindo-timeout` recurs 4× across sprints 22–24, escalating (1 → 2 → 4 records). Flags as systemic.

> **What Budi cares about:** data correctness, pipeline integrity, defect patterns across sprints.

### Step 4 — Sarah signs off

1. Signs back in as `leader` / `leader123`.
2. Opens **Defects → Test Report Generator** → loads **`samples/demo-jamkrindo/sprint24-test-results.csv`** (98 TC, 91.8% pass rate) plus the open defects from Budi's findings.
3. Report highlights: Pefindo CB Enrichment lowest pass-rate module (62.5%), 1 Critical open (NULL NIK, DEF-2026-0129), 1 Major open systemic (Pefindo timeout, DEF-2026-0130).
4. Signs off **conditional on the Pefindo fix (DEF-0130) landing first**.

> **What Sarah cares about:** evidence-based sign-off, traceable risk decisions.

---

## Why three personas matter for the demo

| Concern                     | QA Leader | QC Analyst | Tester |
|-----------------------------|:---------:|:----------:|:------:|
| Sprint dashboard            |    ✅     |            |        |
| Model / cost choice         |    ✅     |            |        |
| Test scenario authoring     |           |            |   ✅   |
| Automation code             |           |            |   ✅   |
| Data quality profiling      |           |    ✅      |        |
| Pipeline validation         |           |    ✅      |        |
| Defect classification       |           |    ✅      |        |
| Defect pattern analysis     |    ✅     |    ✅      |        |
| Final sign-off              |    ✅     |            |        |

Each persona only touches the screens that match their accountability — but the data flows between them via the event bus and shared traceability.

---

## Resetting the demo

To reset users to seed values:

```bash
rm Q/data/users.json
# next request will recreate with the 3 seed users
```

To force-logout everyone (rotate the session secret):

```bash
# In .env.local on local, or Variables tab on Railway:
AUTH_SECRET=<any-new-random-string>
```
