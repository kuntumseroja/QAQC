# Demo dataset — Jamkrindo Cash Loan, Sprint 24

Drop-in sample data for the 3-persona walkthrough in `samples/DEMO-PERSONAS.md`.
Open the file noted in each step in the corresponding QAQC4BI page.

## Files

| File | Used by | Persona | Page |
|------|---------|---------|------|
| `cif_registrations.csv` | Data Quality Profiler | Budi (QC) | Data Analytics → Data Profiler |
| `pipeline-validation-config.json` | ETL/Pipeline Validator | Budi (QC) | Data Analytics → Pipeline Validator |
| `penjaminan-pipeline-log.txt` | Pipeline Validator (input log) | Budi (QC) | Data Analytics → Pipeline Validator |
| `defect-pefindo-timeout.txt` | Defect Classifier | Budi (QC) | Defects → Classifier |
| `defect-history-sprint22-24.csv` | Defect Pattern Analyzer | Budi (QC) | Defects → Pattern Analyzer |
| `sprint24-test-results.csv` | Test Report Generator | Sarah (QA Leader) | Defects → Report Generator |

The Tester (Diana) uses the existing FSDs in `Q/jamkrindo/` (already gitignored locally) — point her to *FSD Registrasi CIF dan Penjaminan Cash Loan.docx* for the scenario-generator step.

## Expected results when running the walkthrough

### Data Quality Profiler (Budi)
Profiling `cif_registrations.csv` should surface:
- **Critical**: 3 NULL `nik` values (rows 3, 9, 15 → CIF-2026-00003 / 00009 / 00015)
- **Major**: 16 NPWP format violations (legacy hyphen format `XX-XXX-XXX-X-XXX-XXX` instead of dotted `XX.XXX.XXX.X-XXX.XXX`)
- 25 rows total, 22 with valid NIK, 9 with valid NPWP (rows 1–9 use dotted format; rows 10–25 use legacy hyphen)

### Pipeline Validator (Budi)
Validating against `pipeline-validation-config.json`:
- 8 stages, 6 PASS / 1 WARN / 2 FAIL
- Highlight: stage `03_pefindo_credit_bureau_enrich` — expected 22, actual 18, missing 4
- Cross-reference with `penjaminan-pipeline-log.txt` for the upstream timeout proof

### Defect Classifier (Budi)
Pasting `defect-pefindo-timeout.txt`:
- AI should classify as **Data Integrity / Pefindo / High**
- Suggested resolution: retry + circuit breaker + DLQ

### Defect Pattern Analyzer (Budi)
Loading `defect-history-sprint22-24.csv`:
- Pattern detected: `pefindo-timeout` recurs 4× across sprints 22–24
- Trend: escalating (1 → 2 → 4 records dropped per run)
- Severity trajectory: Major (consistent)
- Recommendation: prioritize permanent fix

### Test Report Generator (Sarah)
Loading `sprint24-test-results.csv` + the defects:
- Sprint 24 overall pass rate: **91.8%** (90 of 98 TC)
- Lowest module: Pefindo CB Enrichment (62.5%)
- Open Critical defects: 1 (DEF-2026-0129 — NULL NIK)
- Open Major defects: 1 (DEF-2026-0130 — Pefindo timeout, systemic)
- Recommendation: **conditional sign-off** pending DEF-0130 fix

## Reset / regenerate

These files are static fixtures — regenerate by editing the CSV/JSON/TXT directly.
No DB, no migrations, no seeders.
