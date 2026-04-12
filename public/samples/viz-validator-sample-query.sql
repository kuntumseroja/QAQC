-- Dashboard: PSP Transaction Monitoring
-- Source: dw.fact_transactions JOIN dim_psp JOIN dim_date

SELECT
  p.psp_name,
  d.reporting_month,
  COUNT(*) AS transaction_count,
  SUM(t.amount) AS total_amount,
  AVG(t.amount) AS avg_amount,
  SUM(CASE WHEN t.status = 'SUCCESS' THEN 1 ELSE 0 END) AS success_count,
  SUM(CASE WHEN t.status = 'FAILED' THEN 1 ELSE 0 END) AS failed_count,
  ROUND(SUM(CASE WHEN t.status = 'SUCCESS' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) AS success_rate
FROM dw.fact_transactions t
JOIN dim_psp p ON t.psp_id = p.psp_id
JOIN dim_date d ON t.transaction_date = d.date_key
WHERE d.reporting_period = '2026-Q1'
GROUP BY p.psp_name, d.reporting_month
ORDER BY p.psp_name, d.reporting_month;

-- Results:
-- psp_name        | reporting_month | transaction_count | total_amount    | avg_amount | success_count | failed_count | success_rate
-- GoPay           | 2026-01         | 145,230           | 89,400,000,000  | 615,600    | 143,800       | 1,430        | 99.02
-- GoPay           | 2026-02         | 152,100           | 94,200,000,000  | 619,300    | 150,500       | 1,600        | 98.95
-- GoPay           | 2026-03         | 161,450           | 101,500,000,000 | 628,800    | 159,900       | 1,550        | 99.04
-- OVO             | 2026-01         | 98,700            | 45,300,000,000  | 459,000    | 97,200        | 1,500        | 98.48
-- OVO             | 2026-02         | 102,400           | 47,800,000,000  | 466,800    | 100,800       | 1,600        | 98.44
-- OVO             | 2026-03         | 108,900           | 52,100,000,000  | 478,400    | 107,400       | 1,500        | 98.62
-- DANA            | 2026-01         | 87,600            | 38,900,000,000  | 444,100    | 86,300        | 1,300        | 98.52
-- DANA            | 2026-02         | 91,200            | 41,200,000,000  | 451,800    | 89,700        | 1,500        | 98.36
-- DANA            | 2026-03         | 95,800            | 44,600,000,000  | 465,600    | 94,500        | 1,300        | 98.64
-- LinkAja         | 2026-01         | 45,300            | 18,200,000,000  | 401,800    | 44,100        | 1,200        | 97.35
-- LinkAja         | 2026-02         | 43,800            | 17,500,000,000  | 399,500    | 42,500        | 1,300        | 97.03
-- LinkAja         | 2026-03         | 47,100            | 19,800,000,000  | 420,400    | 45,900        | 1,200        | 97.45

-- Dashboard Charts:
-- 1. Bar Chart: Monthly Transaction Volume by PSP (x: month, y: transaction_count, grouped by psp_name)
-- 2. Line Chart: Success Rate Trend (x: month, y: success_rate, lines per PSP) — Y-axis starts at 95%
-- 3. Pie Chart: Market Share by Total Amount (slices: GoPay 52%, OVO 22%, DANA 18%, LinkAja 8%)
-- 4. KPI Cards: Total Transactions = 1,279,580 | Total Amount = Rp 610.5B | Avg Success Rate = 98.49%
-- 5. Data Table: Full breakdown by PSP and month with conditional formatting on success_rate < 98%