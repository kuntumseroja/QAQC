# Demo dataset — Jamkrindo Cash Loan, Sprint 24

Drop-in sample data for the 3-persona walkthrough in `samples/DEMO-PERSONAS.md`.
Open the file noted in each step in the corresponding QAQC4BI page.

All data is grounded in the FSDs in `Q/jamkrindo/` (Registrasi CIF dan Penjaminan Cash Loan, Klaim dan Subrogasi, Master Data dan Konfigurasi, Aplikasi Integrasi ke Oracle).

## Files

| File | Used by | Persona | Page |
|------|---------|---------|------|
| `cif_registrations.csv` | Data Quality Profiler | Budi (QC) | Data Analytics → Data Profiler |
| `pipeline-validation-config.json` | ETL/Pipeline Validator | Budi (QC) | Data Analytics → Pipeline Validator |
| `penjaminan-pipeline-log.txt` | Pipeline Validator (input log) | Budi (QC) | Data Analytics → Pipeline Validator |
| `defect-icpr-sertifikat-upload-failure.txt` | Defect Classifier | Budi (QC) | Defects → Classifier |
| `defect-history-sprint22-24.csv` | (reference only — Pattern Analyzer reads live DB) | Budi (QC) | Defects → Pattern Analyzer |
| `sprint24-test-results.csv` | Test Report Generator | Sarah (QA Leader) | Defects → Report Generator |

The Tester (Diana) uses the FSDs in `Q/jamkrindo/` (gitignored locally) — point her to *FSD Registrasi CIF dan Penjaminan Cash Loan.docx* for the scenario-generator step.

## Jamkrindo domain primer

- **Jamkrindo** = PT Jaminan Kredit Indonesia, OJK-regulated state-owned credit-guarantee company.
- **JaGuarS** = Jamkrindo's core guarantee-management platform.
- **CIF** = Customer Information File (the borrower whose loan is guaranteed).
- **Penjaminan** = the credit guarantee Jamkrindo issues to a partner bank.
- **Sertifikat Penjaminan** = the legal certificate proving the guarantee.
- **IJP** (Imbal Jasa Penjaminan) = guarantee fee Jamkrindo charges, set per PKS.
- **PKS** (Perjanjian Kerja Sama) = master agreement with each partner bank.
- **Klaim** = partner bank claim when the borrower defaults.
- **Subrogasi** = Jamkrindo recovery from the defaulted borrower.
- **ICPR** (Indonesia Credit Penjaminan Repository) = OJK-mandated registry where every Sertifikat Penjaminan must be uploaded within 7 working days.
- **Partner banks** = Mandiri, BRI, BNI, BTN.

## Expected results when running the walkthrough

### Data Quality Profiler (Budi)
Upload `cif_registrations.csv`, choose **mock** provider for deterministic numbers:
- **Critical**: 3 NULL `nik` values (rows 3, 9, 15 → CIF-2026-00003 / 00009 / 00015)
- **Major**: 16 NPWP format violations (rows 10–25 use legacy hyphen `XX-XXX-XXX-X-XXX-XXX`; rows 1–9 use the correct dotted DJP format `XX.XXX.XXX.X-XXX.XXX`)

### Pipeline Validator (Budi)
Validating against `pipeline-validation-config.json` + `penjaminan-pipeline-log.txt`:
- 8 stages: 5 PASS / 1 WARN / 2 FAIL
- Headline failure: stage `06_icpr_upload_sertifikat` — expected 22, actual 16, **6 sertifikat dropped** with HTTP 504 timeout from `api.icpr.ojk.go.id`
- Regulatory implication: 6 certs in `PENDING_ICPR` status — must be uploaded by 2026-04-22 or Jamkrindo breaches OJK 7-day reporting (POJK 1/POJK.05/2016 Pasal 27)

### Defect Classifier (Budi)
Pasting `defect-icpr-sertifikat-upload-failure.txt`:
- AI classifies as **Integration / ICPR / Critical** (regulatory)
- Suggested resolution: retry with backoff + circuit breaker + DLQ + cert PDF compression

### Defect Pattern Analyzer (Budi)
No upload — pick a Time Period and click **Analyze Patterns**. Reads directly from the seeded defects table (16 Jamkrindo defects across sprints 22–24).
- **Top recurring pattern**: `Penjaminan / ICPR / Integration Timeout` recurs **4×** across sprints 22 → 23 → 24 (escalating 1 → 1 → 2 → 6 certs dropped per run)
- **Other patterns**:
  - `Registrasi CIF / Validation Rule` (2× — NIK 15-digit + NPWP hyphen)
  - Cache invalidation, type coercion, master sync, etc.
- **Risk heatmap leader**: Penjaminan / ICPR (risk score 75 — 1 Critical + 3 Major)
- **Open Critical**: DEF-2026-0130 (ICPR systemic), DEF-2026-0129 (NULL NIK)
- **Recommendation**: prioritize permanent ICPR fix before next OJK monthly report

### Test Report Generator (Sarah)
Loading `sprint24-test-results.csv` (16 modules, 128 TCs):
- **Sprint 24 overall pass rate: 90.6%** (116 of 128 TC)
- **Lowest module**: ICPR Sertifikat Upload (25.0%) → directly tied to DEF-0130
- **Open Critical defects**: 1 (DEF-2026-0129 — NULL NIK)
- **Open Major defects affecting OJK SLA**: 1 (DEF-2026-0130 — ICPR timeout, systemic)
- **Recommendation**: **conditional sign-off** pending DEF-0130 fix landing before 2026-04-22 OJK SLA deadline

## Reset / regenerate

These files are static fixtures — regenerate by editing the CSV/JSON/TXT directly.
No DB, no migrations, no seeders for these specific files.

For the seeded `defects` table in SQLite (used by Pattern Analyzer when no CSV is uploaded), the seed lives in `Q/lib/db.ts` and runs on first start of an empty `data/qaqc.db`. Delete `Q/data/qaqc.db` to re-seed.
