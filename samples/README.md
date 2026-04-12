# QAQC-BI Sample Input Files

Sample files for testing the BI-PAY QAQC microservices platform.
All files relate to the Bank Indonesia National Payment System (BI-PAY) project.

---

## File Index

### Scenario Generator (MS-SCEN-001)

| File | Description |
|------|-------------|
| `BRD-PSP-Onboarding-v3.txt` | Business Requirements Document for PSP onboarding workflow. Covers KYB verification, document upload, license validation, approval workflow, and multi-tier classification. Upload this to generate test scenarios for the PSP onboarding module. |
| `SRS-Transaction-Processing-v2.txt` | Software Requirements Specification for the transaction processing engine. Covers ISO 8583 parsing, settlement batches, BI-FAST integration, and SKNBI batch windows. Produces different scenario set than the BRD input. |
| `BRD-Currency-Exchange-v1.txt` | BRD for the Currency Exchange Module. Covers FX rate feeds (Bloomberg/Reuters), multi-currency conversion, rate caching, settlement in source/destination currency, and FX audit trail. Tests that the scenario generator adapts to a different domain (FX vs payments). |

---

### Performance Script Generator (MS-PERF-001)

| File | Description |
|------|-------------|
| `swagger-payment-api.json` | OpenAPI 3.0 Swagger spec for the BI-PAY Payment Gateway API. Includes endpoints for payment submission, status query, bulk payment, QRIS, and FX. Primary input for generating JMeter/k6 performance scripts. |
| `postman-collection-payment.json` | Postman Collection v2.1 with 10 API requests covering authentication, single payment, bulk payment, FX rate lock, cross-border remittance, QRIS generation, settlement query, and transaction reversal. Alternative input to Swagger — tests that the perf generator handles Postman format. Includes pre-request scripts and test assertions. |

---

### IaC Review (MS-INFRA-001)

| File | Description |
|------|-------------|
| `terraform-payment-infra.tf` | Terraform configuration for GKE, Cloud SQL, Redis, and networking for the payment platform. Contains intentional issues for the IaC reviewer to find (public Cloud SQL, missing encryption, over-permissive IAM). |
| `ansible-playbook-deploy.yml` | Ansible playbook (4 plays) deploying the payment application, Redis Sentinel, Nginx reverse proxy, and Prometheus Node Exporter. Contains 20 documented intentional security and operational issues: hardcoded passwords, root execution, disabled TLS validation, world-writable directories, weak TLS ciphers, missing handlers, and more. Tests the IaC reviewer on a different tool (Ansible vs Terraform). |

---

### Defect Classifier (MS-DEFECT-001)

| File | Description |
|------|-------------|
| `defect-report-sample.txt` | Single defect report in structured format. Intended for classifying a single defect by severity, root cause category, and affected module. |

---

### Defect Pattern Analyzer (MS-DEFECT-002)

| File | Description |
|------|-------------|
| `defect-history-6months.txt` | 38 defects across 8 modules over 6 months (Oct 2025 – Mar 2026). Each defect has: ID, title, severity (P1–P4), module, root cause category (CODE/DATA/CONFIG/INFRA/RACE/SCHEMA/THIRD_PARTY), resolution time, and status. Includes intentional patterns: Payment Gateway has highest P1 count (4), Data Pipeline has most data-related issues (7), 3 open defects in Sprint 16, and summary statistics at the end. |

---

### Report Generator (MS-DEFECT-003)

| File | Description |
|------|-------------|
| `sprint14-test-data.txt` | Sprint 14 test execution report (Jan 7–20, 2026). Includes: 312 total test cases, execution/pass/fail/blocked counts by type and user story, 23 defects found with severity breakdown, code coverage metrics from SonarQube (line and branch), performance SLA results (11 metrics, 7 pass / 4 fail), quality gate assessment (4 pass / 8 fail — sprint not cleared for release), sprint-over-sprint trend data, and QA recommendations. |

---

### Automation Code Generator (MS-AUTO-001)

| File | Description |
|------|-------------|
| `manual-test-steps.txt` | Manual test steps in Given/When/Then format for the payment flow. Input for generating Selenium/Playwright/REST Assured automated test code. |

---

### Data Profiler (MS-DATA-001)

| File | Description |
|------|-------------|
| `data-sample-transactions.csv` | Transaction data CSV for profiling. Contains amount distributions, transaction types, timestamps, and PSP identifiers. |
| `data-sample-psp-master.csv` | PSP master data CSV with 15 rows. Columns: psp_id, psp_name, license_number, business_type, status, onboarded_date, tier, daily_limit_idr, contact_email, notes. Contains intentional data quality issues: 2 missing contact emails (PSP-004, PSP-014), 1 invalid date (PSP-012: "32-13-2022"), 1 duplicate license number (PSP-013 shares BI-PSP-2021-0041 with PSP-007), and mixed status values. Tests the profiler on a different schema than the transactions file. |

---

### Security Scan Analyzer (MS-SEC-001)

| File | Description |
|------|-------------|
| `prowler-scan-results.json` | Prowler cloud security scan output in JSON format. Contains findings across IAM, networking, storage, and logging categories for GCP. |

---

### DR/HA Test Generator (MS-INFRA-002)

| File | Description |
|------|-------------|
| `dr-architecture-description.txt` | Architecture description of the payment system's DR/HA setup including RTO/RPO targets, active-passive configuration, and failover mechanisms. Input for generating DR test scenarios. |

---

### Pipeline Validator (MS-DATA-002)

| File | Description |
|------|-------------|
| `etl-pipeline-queries.txt` | ETL SQL queries and pipeline logic for the daily transaction aggregation job. Input for validating data pipeline logic, identifying joins, and checking for potential data quality issues. |

---

### Visualization Validator (MS-DATA-003)

| File | Description |
|------|-------------|
| `viz-dashboard-spec.txt` | Detailed specification for the BI-PAY Payment Analytics Dashboard (Grafana-based). Covers 6 chart panels: monthly volume bar chart (VIZ-001), real-time TPS line chart (VIZ-002), transaction type donut chart (VIZ-003), top PSP performance table (VIZ-004), and 6 system health gauges (VIZ-005 to VIZ-010). Includes color specs, data sources (PostgreSQL + Elasticsearch + Prometheus), threshold values, responsive breakpoints, accessibility requirements, and a UAT validation checklist. |

---

## Data Quality Issues in Sample Files

The following intentional data quality issues are present for testing the data profiler and IaC reviewer:

**data-sample-psp-master.csv:**
- PSP-004 (ShopeePay): `contact_email` is empty
- PSP-012 (BayarInd Digital): `onboarded_date` is "32-13-2022" (invalid day and month)
- PSP-013 (Nusa Payment): `license_number` "BI-PSP-2021-0041" duplicates PSP-007 (Kredivo)
- PSP-014 (RajaPayment): `contact_email` is empty; status is "Probation"

**ansible-playbook-deploy.yml:**
- 20 security and operational issues documented inline with `# ISSUE:` comments
- Categories: credential management, privilege escalation, TLS configuration, service management

---

## Usage Notes

- Files are sized to produce meaningful, non-trivial analysis output from each microservice
- The two BRD files (PSP Onboarding vs Currency Exchange) cover different functional domains — uploading both to the Scenario Generator should produce substantially different test scenario sets
- The Swagger and Postman files both describe the payment API but in different formats — the Perf Script Generator should parse both and produce equivalent script output
- The Terraform and Ansible files both contain IaC issues but for different tools and layers (infrastructure provisioning vs application deployment)
- The two CSV files (transactions vs PSP master) have different schemas and different data quality issue types

---

*Last updated: 2026-04-10*
*Project: BI-PAY QAQC Platform*
