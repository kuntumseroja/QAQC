# QAQC4BI Demo Script
## AI-Powered QA/QC Platform for Bank Indonesia BI-FAST Expansion Project

**Project Context:** Bank Indonesia is expanding the BI-FAST (Bank Indonesia Fast Payment) real-time payment rail to support new PSP (Payment Service Provider) onboarding, cross-border remittance, and QRIS (Quick Response Code Indonesian Standard) integration. The development team is building microservices and APIs that need comprehensive QA/QC before production deployment.

**Demo Duration:** 45-60 minutes
**Audience:** Project Director, Lead Tester, QA Team, Development SMEs
**Presenter:** QA/QC AI Transformation Lead

---

## Pre-Demo Setup

1. Open QAQC4BI at `http://localhost:3000`
2. Verify AI Settings shows **Anthropic Claude Sonnet** or **Ollama Llama 3.1** as active provider
3. Have the sample files ready in `Q/samples/` folder
4. Open browser in full screen mode

---

## ACT 1: Executive Dashboard Overview (5 min)

### Narration:
> "Welcome to QAQC4BI — our AI-powered QA/QC automation platform built specifically for the BI-FAST Expansion project. Let me start with the executive dashboard that gives the Project Director real-time visibility into quality health across all workstreams."

### Steps:
1. Navigate to **Dashboard** (should be the landing page)
2. Point out the 4 KPI cards: Quality Score, Test Coverage, Automation Rate, Defect Density
3. Scroll to Quality Dimension gauges (Application, Data Analytics, Infrastructure scores)
4. Show the Quality Metrics Trend chart — trending upward over last 2 weeks
5. Show the Defect Distribution by Module — Payment Gateway has highest defect count
6. Show Service Health Grid — all 13 microservices healthy
7. Show the Delivery Roadmap — Phase 1 (Foundation) in progress

### Key Talking Points:
- "All 13 AI microservices are operational and healthy"
- "We're tracking quality across ISO 25010 SQuaRE dimensions"
- "The dashboard auto-refreshes and feeds from real project data"

---

## ACT 2: Test Scenario Generation from BI-FAST BRD (10 min)

### Narration:
> "The first pain point we're solving is test scenario creation. Previously, our testers spent 3-5 days manually writing test cases from a BRD. With QAQC4BI, we generate comprehensive positive, negative, and edge case scenarios in under a minute."

### Steps:
1. Navigate to **Application QA/QC > Scenario Generator**
2. Click the upload area and select the demo BRD file

### Demo Input Data:
Paste this into the manual requirements box (or upload as .txt file):

```
REQ-BF-001: BI-FAST Payment Initiation
The system shall accept real-time credit transfer requests via ISO 20022 pacs.008 message format.
Required fields: debtor account (IBAN), creditor account (IBAN), amount (max IDR 250,000,000),
currency (IDR only for domestic), purpose code, and end-to-end transaction ID.
Response time: acknowledgment within 200ms, settlement within 3 seconds.

REQ-BF-002: PSP Onboarding API
The system shall provide REST API endpoints for PSP registration, document submission,
KYC screening trigger, and status inquiry. API authentication via OAuth 2.0 with JWT tokens.
Rate limiting: 100 requests/minute per PSP during onboarding phase.
Required endpoints: POST /api/v1/psp/register, POST /api/v1/psp/documents,
GET /api/v1/psp/{pspId}/status, POST /api/v1/psp/{pspId}/kyc/trigger

REQ-BF-003: QRIS Payment Processing
The system shall generate and validate QRIS QR codes following Bank Indonesia QRIS standard v2.1.
Support both static QR (merchant-presented) and dynamic QR (amount-specific).
QR payload must include: merchant ID, merchant name, transaction amount, currency code (360 for IDR),
tip indicator, and CRC-16 checksum. Maximum QR generation time: 500ms.

REQ-BF-004: Cross-Border Remittance Gateway
The system shall process inbound and outbound remittance transactions via SWIFT gpi and
regional payment corridors (ASEAN). FX rate lookup from Bloomberg/Reuters feed with 15-second cache.
Compliance screening against OFAC, UN, and PPATK sanctions lists required before settlement.
Maximum processing time: 30 seconds including compliance check.

REQ-BF-005: Transaction Reconciliation Engine
The system shall perform T+0 real-time reconciliation matching sender and receiver records.
End-of-day batch reconciliation aggregates positions per PSP institution.
Discrepancy detection must trigger alerts within 5 minutes.
Reconciliation report auto-generated daily at 23:00 WIB.

REQ-BF-006: API Rate Limiter & Circuit Breaker
The system shall enforce per-PSP rate limits based on tier:
Tier 1 (major banks): 10,000 TPS, Tier 2 (medium banks): 5,000 TPS,
Tier 3 (non-bank PSP): 1,000 TPS, Tier 4 (new entrants): 100 TPS.
Circuit breaker activates after 10 consecutive failures with 30-second recovery window.
Rate limit exceeded returns HTTP 429 with Retry-After header.
```

3. Click **"Generate Test Scenarios"**
4. Wait for AI to process (10-30 seconds)

### Expected Results:
- **18 test scenarios** generated (3 per requirement × 6 requirements)
- Each scenario has: Scenario ID, Module, Test Type (Positive/Negative/Edge Case), Priority, Steps, Expected Result, Mapped Requirement
- **Module classification** should include: Payment Processing, PSP Onboarding, API Gateway, Currency Exchange, Reconciliation
- **Distribution bar** shows equal split of Positive (6), Negative (6), Edge Case (6)

### Demo Highlights:
- Click on a Positive scenario for REQ-BF-001 → Steps should reference "ISO 20022 pacs.008", "200ms acknowledgment"
- Click on a Negative scenario for REQ-BF-003 → Steps should test "invalid QR checksum" or "exceeded amount"
- Click on an Edge Case for REQ-BF-006 → Steps should test "at rate limit boundary" or "circuit breaker recovery"
- Show **CSV** and **XLS** export buttons
- Point out that each scenario maps back to its source requirement

### Key Talking Points:
- "Notice how the AI understood the payment domain — it correctly classified modules"
- "Edge cases include timeout, concurrent access, and boundary values specific to payment processing"
- "Each scenario traces back to the original requirement for audit compliance"

---

## ACT 3: Traceability Matrix — Requirements to Test Cases (8 min)

### Narration:
> "Now that we have test scenarios, let's verify our requirements coverage. The traceability matrix maps every requirement to its test cases and identifies gaps — a critical artifact for Bank Indonesia's quality gate assessment."

### Steps:
1. Navigate to **Application QA/QC > Traceability Matrix**
2. In the **Requirements** section (input 1), paste the same 6 requirements from Act 2
3. In the **Test Cases** section (input 2), paste:

### Demo Test Cases Input:

```
TC-BF-001: Valid BI-FAST credit transfer with all mandatory fields
Priority: Critical | Mapped: REQ-BF-001
Steps: Send pacs.008 with valid IBAN, amount 1,000,000 IDR, purpose SALA
Expected: Settlement confirmed within 3 seconds

TC-BF-002: BI-FAST transfer exceeding 250M IDR limit
Priority: High | Mapped: REQ-BF-001
Steps: Send pacs.008 with amount 300,000,000 IDR
Expected: Rejection with error code AMOUNT_EXCEEDED

TC-BF-003: BI-FAST transfer with invalid IBAN format
Priority: High | Mapped: REQ-BF-001
Steps: Send pacs.008 with IBAN "INVALID123"
Expected: Rejection with error code INVALID_ACCOUNT

TC-BF-010: PSP registration with valid data
Priority: Critical | Mapped: REQ-BF-002
Steps: POST /api/v1/psp/register with complete payload
Expected: HTTP 201, PSP ID returned

TC-BF-011: PSP registration rate limit exceeded
Priority: High | Mapped: REQ-BF-002
Steps: Send 101 requests within 1 minute
Expected: HTTP 429 on 101st request

TC-BF-020: Generate static QRIS QR code
Priority: Critical | Mapped: REQ-BF-003
Steps: Request QR for merchant M001, no amount
Expected: Valid QR within 500ms, CRC-16 checksum valid

TC-BF-021: Generate dynamic QRIS with amount
Priority: High | Mapped: REQ-BF-003
Steps: Request QR for merchant M001, amount 50,000 IDR
Expected: QR includes amount field, valid checksum

TC-BF-030: Outbound remittance to Singapore via SWIFT gpi
Priority: Critical | Mapped: REQ-BF-004
Steps: Initiate USD remittance to SG, FX rate lookup, compliance screening
Expected: Transaction processed within 30 seconds

TC-BF-040: Real-time reconciliation match
Priority: High | Mapped: REQ-BF-005
Steps: Send matching debit and credit records
Expected: Records matched in T+0, no discrepancy

TC-BF-050: Rate limiter - Tier 1 at 10,000 TPS
Priority: High | Mapped: REQ-BF-006
Steps: Send exactly 10,000 TPS from Tier 1 PSP
Expected: All requests processed, no 429 errors

TC-BF-051: Circuit breaker activation after 10 failures
Priority: High | Mapped: REQ-BF-006
Steps: Simulate 10 consecutive backend failures
Expected: Circuit breaker OPEN, requests fast-fail for 30 seconds
```

4. Click **"Generate Traceability Matrix"**

### Expected Results:
- **6 requirements** listed with their mapped test cases
- REQ-BF-001 → TC-BF-001, TC-BF-002, TC-BF-003 (3 tests, Covered)
- REQ-BF-002 → TC-BF-010, TC-BF-011 (2 tests, Covered)
- REQ-BF-003 → TC-BF-020, TC-BF-021 (2 tests, Covered)
- REQ-BF-004 → TC-BF-030 (1 test, Covered — but may flag as needing more)
- REQ-BF-005 → TC-BF-040 (1 test, Covered)
- REQ-BF-006 → TC-BF-050, TC-BF-051 (2 tests, Covered)
- **Coverage: 100%** (all 6 requirements have at least 1 test case)
- Coverage bar should be green

### Key Talking Points:
- "REQ-BF-004 only has 1 test case — the AI recommends adding negative and edge cases for cross-border compliance"
- "This matrix is exportable to Excel for the quality gate review meeting"

---

## ACT 4: Performance Test Script Generation (8 min)

### Narration:
> "For the BI-FAST API performance testing, we need JMeter and Gatling scripts that target actual endpoints. Let's generate a load test script from the BI-FAST OpenAPI specification."

### Steps:
1. Navigate to **Application QA/QC > Perf Test Scripts**
2. Upload `samples/swagger-payment-api.json` (or paste the API spec)
3. Set **Performance Tool** to **Apache JMeter (.jmx)**
4. Set **Test Type** to **Load Test**
5. Click **"Generate Performance Script"**

### Expected Results:
- **JMeter .jmx** XML script generated
- Script targets actual endpoints from the Swagger spec: `POST /transactions`, `GET /transactions/{id}`, `POST /transactions/{id}/reverse`
- Config shows: **100 virtual users**, **60s ramp-up**, **30m duration**
- Download button offers `.jmx` file

6. Now change tool to **Gatling** and test type to **Stress Test**
7. Click **"Generate Performance Script"** again

### Expected Results:
- **Gatling .scala** script generated
- Same endpoints but with stress profile: **500 users**, rapid ramp
- Download button offers `.scala` file

### Key Talking Points:
- "The script extracts real endpoints from our Swagger spec — no manual configuration needed"
- "Each script includes parameterized data, assertions, and think times"
- "We can download .jmx and import directly into JMeter, or .scala into Gatling"

---

## ACT 5: IaC Security Review (8 min)

### Narration:
> "Before deploying our BI-FAST infrastructure, we need security review of the Terraform code. The IaC Review Agent scans for CIS Benchmark violations, hardcoded secrets, and misconfigurations."

### Steps:
1. Navigate to **Infrastructure QA/QC > IaC Code Review**
2. Upload `samples/terraform-payment-infra.tf` or paste this Terraform excerpt:

### Demo Terraform Code:

```hcl
resource "aws_security_group" "bifast_api_sg" {
  name = "bifast-api-sg"
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_db_instance" "bifast_db" {
  identifier     = "bifast-settlement-db"
  engine         = "postgres"
  engine_version = "15.4"
  instance_class = "db.r6g.xlarge"
  username       = "bifast_admin"
  password       = "BIFast2026!SecretPwd"
  storage_encrypted   = false
  publicly_accessible = true
  backup_retention_period = 0
  deletion_protection     = false
}

resource "aws_iam_role_policy" "bifast_service_policy" {
  policy = jsonencode({
    Statement = [{
      Effect   = "Allow"
      Action   = "*"
      Resource = "*"
    }]
  })
}

resource "aws_s3_bucket" "bifast_audit_logs" {
  bucket = "bifast-audit-logs-2026"
}
```

3. Click **"Review IaC Code"**

### Expected Results:
- **Compliance Score: ~25-30%** (many issues)
- Findings with actual line numbers:
  - **Critical**: `cidr_blocks = ["0.0.0.0/0"]` on port 22 — SSH open to internet
  - **Critical**: `password = "BIFast2026!SecretPwd"` — hardcoded database password
  - **Critical**: `Action = "*"` — wildcard IAM permissions
  - **High**: `storage_encrypted = false` — unencrypted database storage
  - **Critical**: `publicly_accessible = true` — database exposed to internet
  - **Low**: Missing tags on S3 bucket and other resources
- Each finding has: severity badge, file:line reference, CIS control, recommendation, and fix code snippet
- CSV and XLS export available for the findings

### Key Talking Points:
- "The AI found 6+ real security issues — these would fail Bank Indonesia's Pengamanan Sistem Informasi audit"
- "Each finding maps to a CIS Benchmark control with actionable remediation code"
- "The hardcoded password is especially critical — we recommend AWS Secrets Manager"

---

## ACT 6: Defect Classification (5 min)

### Narration:
> "When testers find bugs during BI-FAST testing, the Defect Classifier automatically triages them — determining severity, priority, root cause, and which team should fix it."

### Steps:
1. Navigate to **Defect Management > Defect Classifier**
2. Paste this defect description:

### Demo Defect Input:

**Defect Description:**
```
During BI-FAST load testing at 8,000 TPS, the settlement microservice
returns HTTP 504 Gateway Timeout after 45 seconds for approximately 12%
of transactions. The affected transactions remain stuck in PROCESSING
state and are not rolled back. Database connection pool exhaustion
observed in metrics — active connections hit max (100) while idle
connections drop to 0. This blocks the PSP settlement cycle and could
cause financial discrepancy if not resolved before go-live.
```

**Error Logs (optional):**
```
2026-04-10T14:23:45.123Z ERROR [settlement-svc] Connection pool exhausted: active=100, idle=0, waiting=847
2026-04-10T14:23:45.456Z ERROR [settlement-svc] Transaction TXN-BF-20260410-A1B2C3 timeout after 45000ms
2026-04-10T14:23:46.012Z WARN  [settlement-svc] Circuit breaker OPEN for database pool
2026-04-10T14:23:46.234Z ERROR [settlement-svc] 1,247 transactions stuck in PROCESSING state
```

3. Click **"Classify Defect"**

### Expected Results:
- **Severity: Critical** (system crash/data loss potential)
- **Priority: High** (blocks payment processing)
- **Root Cause: Performance Bottleneck** (connection pool exhaustion)
- **Assigned Team: Platform Team** or **Backend Team**
- **Confidence scores**: Severity 85%+, Priority 80%+
- Workflow diagram: OPEN → UNDER REVIEW → CONFIRMED → IN PROGRESS → RESOLVED → CLOSED
- Similar historical defects listed

### Key Talking Points:
- "The AI correctly identified this as a connection pool issue, not a code logic bug"
- "Critical severity because transactions are stuck — potential financial impact"
- "The workflow shows the standard BI defect lifecycle we follow"

---

## ACT 7: Test Report Generation (5 min)

### Narration:
> "Finally, let's generate the Sprint QC Summary Report that the Project Director reviews at the quality gate meeting."

### Steps:
1. Navigate to **Defect Management > Report Generator**
2. Set **Report Type** to **QC Summary**
3. In Sprint/Period, enter: `Sprint 14 — BI-FAST API Integration Testing`
4. Click **"Generate Report"**

### Expected Results:
- Formatted report with sections:
  - **Executive Summary**: Sprint overview with pass/fail assessment
  - **Test Execution Metrics**: Total cases, pass rate, blocked count
  - **Defect Summary**: Breakdown by severity
  - **Quality Gate Assessment**: Table with PASS/FAIL per criterion
  - **Risk Assessment**: Risks and recommendations
- Export buttons: **Export HTML**, **Export JSON**, **Print to PDF**

### Key Talking Points:
- "This report follows Bank Indonesia's standard QC report format"
- "The HTML export is print-ready — the Project Director can review it immediately"
- "Quality gate shows which criteria passed and which need attention"

---

## ACT 8: Document Audit Trail (3 min)

### Narration:
> "All documents uploaded to QAQC4BI are tracked in the audit trail. When the project ends or documents are no longer needed, they can be permanently deleted for data governance compliance."

### Steps:
1. Navigate to **Document Audit** in the sidebar
2. Show the active documents list with file names, sizes, services used
3. Demonstrate soft delete of a document
4. Switch to "Deleted Documents" tab
5. Show restore and permanent delete options

### Key Talking Points:
- "Every upload is logged with timestamp, user, and service"
- "Deleted documents can be restored or permanently purged"
- "This ensures compliance with Bank Indonesia data retention policies"

---

## Closing (2 min)

### Narration:
> "To summarize — QAQC4BI covers the entire QA/QC lifecycle for the BI-FAST Expansion project:
>
> 1. **Test Scenario Generation** from requirements — 60-70% time reduction
> 2. **Traceability Matrix** with automatic gap detection
> 3. **Performance Test Scripts** in JMeter and Gatling formats
> 4. **IaC Security Review** with CIS Benchmark compliance
> 5. **Data Quality Profiling** across ISO 8000 dimensions
> 6. **ETL Pipeline Validation** with transformation spec support
> 7. **Intelligent Defect Classification** with root cause analysis
> 8. **Automated Report Generation** for quality gate reviews
>
> All powered by AI — either local Ollama for data privacy, or Anthropic Claude Sonnet for maximum accuracy. The platform is ready for Phase 1 deployment supporting the BI-FAST expansion timeline."

---

## Quick Reference: Demo Data Files

| Act | Input File | Location |
|-----|-----------|----------|
| 2 | BI-FAST BRD | Paste from script above |
| 3 | Requirements + Test Cases | Paste from script above |
| 4 | OpenAPI Spec | `samples/swagger-payment-api.json` |
| 5 | Terraform Code | `samples/terraform-payment-infra.tf` |
| 6 | Defect Report | Paste from script above |
| 7 | Sprint Data | Type "Sprint 14" |
| - | PSP Master CSV | `samples/data-sample-psp-master.csv` |
| - | ETL Queries | `samples/etl-pipeline-queries.txt` |
| - | DR Architecture | `samples/dr-architecture-description.txt` |
| - | Prowler Results | `samples/prowler-scan-results.json` |
| - | Dashboard Spec | `samples/viz-dashboard-spec.txt` |

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| LLM timeout | Wait 30-60s for Ollama; Anthropic is faster (~10s) |
| Empty results | Check AI Settings — ensure provider is configured |
| PDF upload fails | Use .txt version of the document instead |
| NaN in results | Refresh the page and retry |
| API key error | Check `.env.local` has valid `ANTHROPIC_API_KEY` |
