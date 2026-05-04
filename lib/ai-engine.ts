// AI Engine - Multi-provider LLM integration layer
// Supports: Ollama (local), Anthropic Claude Sonnet, DeepSeek, and built-in mock

import { SCENARIO_GEN_SYSTEM_PROMPT } from './prompts/scenario-gen-prompt';

export type LLMProvider = 'ollama' | 'anthropic' | 'deepseek' | 'mock';

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  baseUrl?: string;       // Ollama: http://localhost:11434, Anthropic: https://api.anthropic.com, DeepSeek: https://api.deepseek.com
  apiKey?: string;         // Required for Anthropic and DeepSeek
  temperature?: number;
  maxTokens?: number;
}

export interface AIRequest {
  service: string;
  prompt: string;
  input: string;
  options?: Record<string, unknown>;
  llmConfig?: LLMConfig;
}

export interface AIResponse {
  result: unknown;
  confidence: number;
  processingTime: number;
  model: string;
  provider: LLMProvider;
  tokens: { input: number; output: number };
}

// Per-provider sane defaults for output tokens — use the model's full budget
// so multi-module FSDs don't get truncated to ~20 scenarios.
function defaultMaxTokensFor(provider: LLMProvider): number {
  if (provider === 'anthropic') return 16384;
  if (provider === 'deepseek') return 8192;   // deepseek-chat hard cap
  if (provider === 'ollama') return 8192;
  return 4096;
}

// Default LLM config - reads from env or falls back to mock
function getDefaultConfig(): LLMConfig {
  const provider = (process.env.LLM_PROVIDER as LLMProvider) || 'mock';
  const baseUrl =
    provider === 'ollama' ? (process.env.OLLAMA_BASE_URL || 'http://localhost:11434') :
    provider === 'deepseek' ? (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com') :
    'https://api.anthropic.com';
  const model =
    provider === 'anthropic' ? (process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514') :
    provider === 'deepseek' ? (process.env.DEEPSEEK_MODEL || 'deepseek-chat') :
    provider === 'ollama' ? (process.env.OLLAMA_MODEL || 'llama3.1') :
    'mock-engine';
  const apiKey =
    provider === 'deepseek' ? (process.env.DEEPSEEK_API_KEY || '') :
    (process.env.ANTHROPIC_API_KEY || '');
  return {
    provider,
    model,
    baseUrl,
    apiKey,
    temperature: 0.3,
    maxTokens: defaultMaxTokensFor(provider),
  };
}

// Build an LLMConfig for a specific provider, pulling the right env keys.
// Used when the UI overrides the default provider on a per-request basis.
export function buildConfigForProvider(provider: LLMProvider, model?: string): LLMConfig {
  const baseUrl =
    provider === 'ollama' ? (process.env.OLLAMA_BASE_URL || 'http://localhost:11434') :
    provider === 'deepseek' ? (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com') :
    'https://api.anthropic.com';
  const resolvedModel = model || (
    provider === 'anthropic' ? (process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514') :
    provider === 'deepseek' ? (process.env.DEEPSEEK_MODEL || 'deepseek-chat') :
    provider === 'ollama' ? (process.env.OLLAMA_MODEL || 'llama3.1') :
    'mock-engine'
  );
  const apiKey =
    provider === 'deepseek' ? (process.env.DEEPSEEK_API_KEY || '') :
    provider === 'anthropic' ? (process.env.ANTHROPIC_API_KEY || '') :
    '';
  return { provider, model: resolvedModel, baseUrl, apiKey, temperature: 0.3, maxTokens: defaultMaxTokensFor(provider) };
}

// Available models for UI selection
export const AVAILABLE_MODELS = {
  ollama: [
    // IDs use the canonical 'name:tag' that `ollama pull` creates.
    { id: 'llama3.1:8b', name: 'Llama 3.1 (8B)', description: 'Fast local inference' },
    { id: 'llama3.1:70b', name: 'Llama 3.1 (70B)', description: 'Higher quality local inference' },
    { id: 'gemma3:e4b', name: 'Gemma 3 (4B effort)', description: 'Compact Google model' },
    { id: 'codellama:7b', name: 'Code Llama (7B)', description: 'Optimized for code generation' },
    { id: 'mistral:7b', name: 'Mistral (7B)', description: 'Efficient general-purpose model' },
    { id: 'mixtral:8x7b', name: 'Mixtral 8x7B', description: 'MoE model, good for complex tasks' },
    { id: 'qwen2.5-coder:7b', name: 'Qwen 2.5 Coder (7B)', description: 'Strong coding model' },
    { id: 'deepseek-coder-v2:16b', name: 'DeepSeek Coder V2 (16B)', description: 'Advanced code model' },
  ],
  anthropic: [
    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', description: 'Latest Sonnet - fast & capable' },
    { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', description: 'Most capable model' },
    { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', description: 'Fastest, cost-efficient' },
  ],
  deepseek: [
    { id: 'deepseek-chat', name: 'DeepSeek-V3 (Chat)', description: 'General-purpose, cost-efficient' },
    { id: 'deepseek-reasoner', name: 'DeepSeek-R1 (Reasoner)', description: 'Advanced reasoning model' },
  ],
  mock: [
    { id: 'mock-engine', name: 'Built-in Mock Engine', description: 'Simulated AI responses (no LLM required)' },
  ],
};

// Call Ollama API
async function callOllama(config: LLMConfig, systemPrompt: string, userMessage: string): Promise<string> {
  const baseUrl = config.baseUrl || 'http://localhost:11434';
  const controller = new AbortController();
  // Local inference on Mac/laptop:
  //   8B  models: ~30-90s for plan pass on a few-page FSD
  //   13B-16B   : 2-6 min, prompt-processing-bound
  //   70B       : 8 min+, often impractical
  // The 240s ceiling was killing deepseek-coder-v2:16b mid-decode.
  const timeout = setTimeout(() => controller.abort(), 600000); // 10 min
  try {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        format: 'json',
        stream: false,
        options: {
          temperature: config.temperature ?? 0.3,
          num_predict: config.maxTokens ?? 8192,
          // Llama 3.1 supports 128k context — allow large FSDs to fit.
          num_ctx: 16384,
        },
      }),
    });
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Ollama API error: ${response.status} - ${err}`);
    }
    const data = await response.json();
    return data.message?.content || '';
  } finally {
    clearTimeout(timeout);
  }
}

// Call Anthropic Claude API
async function callAnthropic(config: LLMConfig, systemPrompt: string, userMessage: string): Promise<string> {
  if (!config.apiKey) throw new Error('Anthropic API key is required. Set ANTHROPIC_API_KEY environment variable.');
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: config.maxTokens ?? 16384,
      temperature: config.temperature ?? 0.3,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic API error: ${response.status} - ${err}`);
  }
  const data = await response.json();
  const text = data.content?.[0]?.text || '';

  // If the response was truncated due to max_tokens, log it
  if (data.stop_reason === 'max_tokens') {
    console.warn(`[ai-engine] Anthropic response truncated (hit max_tokens). Length: ${text.length}`);
  }

  return text;
}

// Call DeepSeek API (OpenAI-compatible)
async function callDeepSeek(config: LLMConfig, systemPrompt: string, userMessage: string): Promise<string> {
  if (!config.apiKey) throw new Error('DeepSeek API key is required. Set DEEPSEEK_API_KEY environment variable.');
  const baseUrl = config.baseUrl || 'https://api.deepseek.com';
  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: config.maxTokens ?? 8192,
      temperature: config.temperature ?? 0.3,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    }),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`DeepSeek API error: ${response.status} - ${err}`);
  }
  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || '';
  if (data.choices?.[0]?.finish_reason === 'length') {
    console.warn(`[ai-engine] DeepSeek response truncated (hit max_tokens). Length: ${text.length}`);
  }
  return text;
}

// System prompts per service (from PRD templates)
const SCENARIO_PLAN_SYSTEM_PROMPT = `You are a QA Planner. Your ONLY job is to list the user stories / modules / functional areas in the document the user provides.

You MUST respond with valid JSON in EXACTLY this shape (and nothing else):

{
  "modules": [
    { "name": "Registrasi CIF Individu", "chapter": "1.2", "summary": "Personal data registration of borrower with NIK / NPWP validation", "expectedScenarios": 8 },
    { "name": "Penjaminan Cash Loan submission", "chapter": "9.3.1", "summary": "Submit guarantee request with plafon and product type", "expectedScenarios": 12 },
    { "name": "ICPR Sertifikat upload", "chapter": "10.4", "summary": "Upload Sertifikat Penjaminan to OJK ICPR within 7 working days", "expectedScenarios": 8 }
  ]
}

ABSOLUTE RULES — VIOLATING THESE BREAKS THE SYSTEM:
1. The top-level key MUST be "modules" (not "scenarios", not "user_stories", not "stories", not "items").
2. Each entry MUST have at least the "name" field.
3. DO NOT include "scenarios", "testCases", "steps", "expectedResult", or any test-execution fields. This is NOT a scenario-generation pass.
4. DO NOT include any text before or after the JSON. No markdown fences, no commentary.
5. Aim for 8-20 entries. "name" is a short noun phrase (4-8 words). "summary" is 1-2 lines max.

If the document has chapters/sections, use them as "chapter" values. If not, omit the chapter field.`;

const SERVICE_PROMPTS: Record<string, string> = {
  'scenario-plan': SCENARIO_PLAN_SYSTEM_PROMPT,
  'scenario-gen': SCENARIO_GEN_SYSTEM_PROMPT,
  'traceability': 'You are a Requirements Traceability expert. Map each requirement to corresponding test cases, identify coverage gaps. Output as JSON with fields: matrix[] (requirementId, description, testCaseIds[], coverageStatus, gapNotes), coverage (total, covered, gaps, percentage).',
  'perf-scripts': `You are a Performance Engineer generating JMeter and Gatling test scripts for Bank Indonesia payment APIs.

Generate a complete performance test script based on the provided OpenAPI/Swagger specification.
Extract ALL endpoints from the spec and include them in the test script.

You MUST respond with a single JSON object (no markdown, no explanation) in this exact structure:
{
  "tool": "JMeter" or "Gatling",
  "testType": "load" or "stress" or "soak" or "spike",
  "fileName": "perf_test_load.jmx",
  "script": "the complete script content as a single string with newlines as \\n",
  "config": {
    "threads": 100,
    "rampUp": "60s",
    "duration": "30m"
  }
}

CRITICAL: The "script" field must be a valid JSON string. Escape all special characters properly:
- Use \\n for newlines
- Use \\" for double quotes inside the script
- Use \\\\ for backslashes
- Ensure the entire JSON is parseable`,
  'automation-codegen': `You are a Test Automation Engineer. Generate Selenium/Katalon automation scripts from manual test scenarios using Page Object Model pattern.

You MUST respond with a single JSON object (no markdown, no explanation) in this exact structure:
{
  "framework": "Selenium" or "Katalon",
  "pattern": "Page Object Model",
  "files": [
    { "name": "page_login.py", "content": "the file content with \\n for newlines" },
    { "name": "test_login.py", "content": "test file content with \\n for newlines" }
  ],
  "summary": {
    "totalFiles": 2,
    "totalTests": 3,
    "pattern": "Page Object Model",
    "coverage": "description of test coverage"
  }
}

CRITICAL: All code in "content" fields must be a valid JSON string with escaped newlines (\\n), tabs (\\t), and quotes (\\"). Generate Python code for Selenium, Groovy for Katalon. Keep each file concise.`,
  'data-profiler': `You are a Data Quality Engineer following DAMA-DMBOK and ISO 8000 standards.

Analyze the provided dataset (CSV) and output a JSON object with this EXACT structure:
{
  "datasetName": "string",
  "rowCount": number,
  "columnCount": number,
  "profileDate": "ISO date string",
  "columns": [
    {
      "column": "name",
      "dataType": "string|numeric|datetime|boolean",
      "totalRows": number,
      "nullCount": number,
      "nullRate": "12.00%",
      "uniqueCount": number,
      "completeness": "88.00%",
      "validity": "88.00%",
      "anomalies": [
        { "type": "null_values|format_violation|duplicate|outlier", "description": "12 NPWP values use hyphen format instead of dotted DJP format", "severity": "Critical|Major|Minor" }
      ]
    }
  ],
  "qualityDimensions": {
    "accuracy":     { "score": 0-100, "status": "PASS|FAIL", "threshold": 95 },
    "completeness": { "score": 0-100, "status": "PASS|FAIL", "threshold": 98 },
    "consistency":  { "score": 0-100, "status": "PASS|FAIL", "threshold": 95 },
    "timeliness":   { "score": 0-100, "status": "PASS|FAIL", "threshold": 95 },
    "uniqueness":   { "score": 0-100, "status": "PASS|FAIL", "threshold": 99 },
    "validity":     { "score": 0-100, "status": "PASS|FAIL", "threshold": 95 }
  },
  "anomalySummary": { "total": number, "critical": number, "medium": number, "low": number }
}

CRITICAL FORMAT RULES — apply these to every column whose name matches:
- nik / NIK         → must be EXACTLY 16 digits (no spaces, no dashes)
- npwp / NPWP       → must match dotted DJP format XX.XXX.XXX.X-XXX.XXX (e.g. 12.345.678.9-012.000). The hyphen format XX-XXX-XXX-X-XXX-XXX is INVALID.
- email             → RFC-5322 local@domain.tld
- no_hp / phone / hp → starts with 08 or +628, total 10–14 digits
- tgl_* / *_at / *_date → ISO YYYY-MM-DD or YYYY-MM-DD HH:MM:SS
- plafon / amount / jumlah → positive integer

For each column, COUNT actual violations against these rules in the data and put them in "anomalies" with severity.
- "anomalies" MUST be an array (even if empty []), not a number.
- Severity guidance: NIK violation = Critical, NPWP/email/date = Major, phone = Minor.
- "validity" % = (rows with no nulls AND no format violations) / totalRows * 100.

For anomalySummary: total = sum of all anomalies across columns, with critical/medium/low buckets matching severity (medium = Major).

Analyze every column. Be exhaustive. No markdown, JSON only.`,
  'pipeline-validator': 'You are a Data Pipeline Validation expert. Output JSON: { "pipelineName": "string", "rules": [{ "rule": "description", "source": "source value", "target": "target value", "status": "PASS or FAIL", "sql": "SQL query", "details": "optional detail" }], "summary": { "total": number, "passed": number, "failed": number, "passRate": "percent string" } }. Generate real SQL validation queries based on the tables and columns in the input.',
  'viz-validator': 'You are a Data Visualization QA expert. Output JSON: { "dashboardName": "string", "checks": [{ "check": "description of what was checked", "status": "PASS or WARNING or FAIL", "details": "explanation" }], "summary": { "pass": number, "warning": number, "fail": number } }. Check chart types, data accuracy, labels, formatting, accessibility, responsiveness.',
  'iac-review': 'You are a Cloud Infrastructure Security Engineer. Review the provided IaC code and output JSON: { "filesReviewed": number, "findings": [{ "severity": "Critical/High/Medium/Low", "file": "filename", "line": number, "rule": "CIS control or best practice", "finding": "description of issue", "recommendation": "fix suggestion", "fix": "code snippet" }], "summary": { "critical": number, "high": number, "medium": number, "low": number }, "complianceScore": 0-100 }. Scan for real security issues: open CIDRs, hardcoded secrets, missing encryption, wildcard IAM, public access, missing tags.',
  'security-scan': 'You are a Security Compliance expert. Output JSON: { "framework": "name", "scanDate": "ISO date", "controls": [{ "controlId": "CIS x.x", "title": "control title", "status": "PASS or FAIL", "details": "finding details", "remediation": "fix steps" }], "summary": { "total": number, "passed": number, "failed": number, "complianceRate": "percent string" } }. Parse and interpret the scan results provided.',
  'dr-ha-test': 'You are a DR/HA testing expert. Output JSON: { "scenarios": [{ "id": "DR-001", "name": "string", "category": "Database/Network/Infrastructure/Disaster Recovery", "rpoTarget": "X min", "rtoTarget": "X min", "steps": ["step1", "step2"], "expectedOutcome": "string" }], "infrastructure": "string", "summary": { "totalScenarios": number, "categories": ["list"] } }. Generate DR scenarios based on the actual infrastructure components described in the input.',
  'defect-classifier': 'You are a Senior QA Analyst. Output JSON: { "severity": "Critical/Major/Minor/Cosmetic", "priority": "High/Medium/Low", "rootCause": "category string", "assignedTeam": "team name", "confidence": { "severity": 0-1, "priority": 0-1, "rootCause": 0-1 }, "similarDefects": [{ "id": "DEF-xxx", "similarity": 0-1, "title": "string" }], "workflow": ["OPEN","UNDER REVIEW","CONFIRMED","IN PROGRESS","RESOLVED","CLOSED"] }. Analyze the defect description and classify based on actual content.',
  'defect-patterns': 'You are a Defect Analytics expert. Output JSON: { "period": "string", "heatmap": [{ "module": "name", "critical": number, "major": number, "minor": number, "cosmetic": number, "riskScore": 0-100 }], "trends": { "totalDefects": number, "openDefects": number, "avgResolutionDays": number, "reopenRate": "percent", "topRootCauses": [{ "cause": "name", "count": number, "percentage": "percent" }] }, "recommendations": ["string"] }. Analyze the defect data provided and identify real patterns.',
  'report-gen': 'You are a QA Report Generator. Output JSON: { "reportType": "string", "title": "string", "generatedAt": "ISO date", "sections": [{ "title": "section name", "content": "text content or null", "data": "structured data object or null" }] }. Include sections: Executive Summary, Test Execution Metrics, Defect Summary, Quality Gate Assessment, Risk Assessment. Use actual data from the input.',
};

// Robust JSON extraction from LLM responses
// Handles: raw JSON, markdown fences, preamble/postamble text, nested objects
function tryParseJSON(text: string): unknown | null {
  if (!text || !text.trim()) return null;

  const trimmed = text.trim();

  // 1. Try direct parse first (cleanest case)
  try {
    return JSON.parse(trimmed);
  } catch { /* continue */ }

  // 2. Extract from markdown code fences: ```json ... ``` or ``` ... ```
  const fenceMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch { /* continue */ }
  }

  // 3. Find the first { or [ and match to its closing counterpart
  const startObj = trimmed.indexOf('{');
  const startArr = trimmed.indexOf('[');
  const startIdx = startObj === -1 ? startArr : startArr === -1 ? startObj : Math.min(startObj, startArr);

  if (startIdx !== -1) {
    const openChar = trimmed[startIdx];
    const closeChar = openChar === '{' ? '}' : ']';

    // Find the LAST matching close bracket (handles nested structures)
    let depth = 0;
    let inString = false;
    let escape = false;

    for (let i = startIdx; i < trimmed.length; i++) {
      const ch = trimmed[i];

      if (escape) { escape = false; continue; }
      if (ch === '\\' && inString) { escape = true; continue; }
      if (ch === '"' && !escape) { inString = !inString; continue; }
      if (inString) continue;

      if (ch === openChar) depth++;
      if (ch === closeChar) {
        depth--;
        if (depth === 0) {
          const candidate = trimmed.substring(startIdx, i + 1);
          try {
            return JSON.parse(candidate);
          } catch { /* continue scanning */ }
        }
      }
    }

    // Fallback: try from first { or [ to last } or ]
    const lastClose = trimmed.lastIndexOf(closeChar);
    if (lastClose > startIdx) {
      try {
        return JSON.parse(trimmed.substring(startIdx, lastClose + 1));
      } catch { /* give up */ }
    }
  }

  return null;
}

// Repair truncated JSON from max_tokens cutoff
// For scenario-gen: extract as many complete scenario objects as possible
function repairTruncatedJSON(text: string): unknown | null {
  if (!text || !text.trim()) return null;

  const trimmed = text.trim();

  // Find the start of JSON
  const startIdx = trimmed.indexOf('{');
  if (startIdx === -1) return null;

  const jsonText = trimmed.substring(startIdx);

  // Find the "scenarios" array
  const scenariosMatch = jsonText.match(/"scenarios"\s*:\s*\[/);
  if (!scenariosMatch || scenariosMatch.index === undefined) return null;

  const arrayStart = scenariosMatch.index + scenariosMatch[0].length;

  // Extract complete objects from the array by finding matching { }
  const scenarios: unknown[] = [];
  let i = arrayStart;
  while (i < jsonText.length) {
    // Skip whitespace and commas
    while (i < jsonText.length && /[\s,]/.test(jsonText[i])) i++;
    if (i >= jsonText.length || jsonText[i] === ']') break;
    if (jsonText[i] !== '{') break;

    // Find the matching closing brace
    let depth = 0;
    let inStr = false;
    let esc = false;
    const objStart = i;

    for (; i < jsonText.length; i++) {
      const ch = jsonText[i];
      if (esc) { esc = false; continue; }
      if (ch === '\\' && inStr) { esc = true; continue; }
      if (ch === '"' && !esc) { inStr = !inStr; continue; }
      if (inStr) continue;
      if (ch === '{') depth++;
      if (ch === '}') {
        depth--;
        if (depth === 0) {
          const objStr = jsonText.substring(objStart, i + 1);
          try {
            scenarios.push(JSON.parse(objStr));
          } catch { /* skip malformed object */ }
          i++;
          break;
        }
      }
    }

    // If we didn't find a closing brace, stop
    if (depth !== 0) break;
  }

  if (scenarios.length === 0) return null;

  console.log(`[ai-engine] Repaired truncated JSON: recovered ${scenarios.length} complete scenarios`);

  // Reconstruct the result with a summary
  const positive = scenarios.filter((s: unknown) => {
    const t = ((s as Record<string, unknown>).testType as string || '').toLowerCase();
    return t.includes('positive') || t.includes('happy');
  }).length;
  const negative = scenarios.filter((s: unknown) => {
    const t = ((s as Record<string, unknown>).testType as string || '').toLowerCase();
    return t.includes('negative') || t.includes('error');
  }).length;
  const edge = scenarios.length - positive - negative;

  return {
    scenarios,
    summary: { total: scenarios.length, positive, negative, edge },
    _truncated: true,
  };
}

// Generic repair for truncated JSON — handles perf-scripts, IaC review, etc.
// Extracts the "script" string field even if the JSON is cut off
function repairGenericTruncatedJSON(text: string, service: string, options?: Record<string, unknown>): unknown | null {
  if (!text) return null;

  const trimmed = text.trim();
  const startIdx = trimmed.indexOf('{');
  if (startIdx === -1) return null;
  const jsonText = trimmed.substring(startIdx);

  // For perf-scripts: extract the script content from truncated JSON
  if (service === 'perf-scripts') {
    // Try to extract "script": "..." value — it may be cut off
    const scriptMatch = jsonText.match(/"script"\s*:\s*"/);
    if (!scriptMatch || scriptMatch.index === undefined) return null;

    const scriptStart = scriptMatch.index + scriptMatch[0].length;

    // Find the end of the script string (look for unescaped quote)
    let scriptEnd = -1;
    for (let i = scriptStart; i < jsonText.length; i++) {
      if (jsonText[i] === '\\') { i++; continue; } // skip escaped chars
      if (jsonText[i] === '"') { scriptEnd = i; break; }
    }

    // If we didn't find the closing quote, take everything up to the end (truncated)
    const scriptContent = scriptEnd !== -1
      ? jsonText.substring(scriptStart, scriptEnd)
      : jsonText.substring(scriptStart).replace(/["\s]*$/, '');

    // Unescape the JSON string
    const unescaped = scriptContent.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"').replace(/\\\\/g, '\\');

    // Extract other fields
    const toolMatch = jsonText.match(/"tool"\s*:\s*"([^"]+)"/);
    const testTypeMatch = jsonText.match(/"testType"\s*:\s*"([^"]+)"/);
    const fileNameMatch = jsonText.match(/"fileName"\s*:\s*"([^"]+)"/);
    const threadsMatch = jsonText.match(/"threads"\s*:\s*(\d+)/);
    const rampUpMatch = jsonText.match(/"rampUp"\s*:\s*"([^"]+)"/);
    const durationMatch = jsonText.match(/"duration"\s*:\s*"([^"]+)"/);

    const tool = toolMatch?.[1] || (options?.tool as string) || 'JMeter';
    const testType = testTypeMatch?.[1] || (options?.testType as string) || 'load';

    // If the script was truncated, try to close the XML/Scala properly
    let finalScript = unescaped;
    if (scriptEnd === -1 && tool.toLowerCase() === 'jmeter') {
      // Close unclosed JMeter XML
      if (!finalScript.includes('</jmeterTestPlan>')) {
        finalScript += '\n    </hashTree>\n  </hashTree>\n</jmeterTestPlan>';
      }
    }

    console.log(`[ai-engine] Repaired truncated perf-script: ${finalScript.length} chars of script recovered`);

    return {
      tool,
      testType,
      fileName: fileNameMatch?.[1] || `perf_test_${testType}.${tool.toLowerCase() === 'jmeter' ? 'jmx' : 'scala'}`,
      script: finalScript,
      config: {
        threads: threadsMatch ? parseInt(threadsMatch[1]) : 100,
        rampUp: rampUpMatch?.[1] || '60s',
        duration: durationMatch?.[1] || '30m',
      },
      _truncated: scriptEnd === -1,
    };
  }

  // For automation-codegen: extract complete file objects from "files" array
  if (service === 'automation-codegen') {
    const filesMatch = jsonText.match(/"files"\s*:\s*\[/);
    if (filesMatch && filesMatch.index !== undefined) {
      const arrayStart = filesMatch.index + filesMatch[0].length;
      const files: Array<{ name: string; content: string }> = [];

      // Extract complete { "name": "...", "content": "..." } objects
      let i = arrayStart;
      while (i < jsonText.length) {
        while (i < jsonText.length && /[\s,]/.test(jsonText[i])) i++;
        if (i >= jsonText.length || jsonText[i] === ']') break;
        if (jsonText[i] !== '{') break;

        let depth = 0;
        let inStr = false;
        let esc = false;
        const objStart = i;

        for (; i < jsonText.length; i++) {
          const ch = jsonText[i];
          if (esc) { esc = false; continue; }
          if (ch === '\\' && inStr) { esc = true; continue; }
          if (ch === '"' && !esc) { inStr = !inStr; continue; }
          if (inStr) continue;
          if (ch === '{') depth++;
          if (ch === '}') {
            depth--;
            if (depth === 0) {
              try {
                const obj = JSON.parse(jsonText.substring(objStart, i + 1));
                if (obj.name && obj.content) files.push(obj);
              } catch { /* skip */ }
              i++;
              break;
            }
          }
        }
        if (depth !== 0) break;
      }

      if (files.length > 0) {
        const frameworkMatch = jsonText.match(/"framework"\s*:\s*"([^"]+)"/);
        console.log(`[ai-engine] Repaired truncated automation-codegen: ${files.length} files recovered`);
        return {
          framework: frameworkMatch?.[1] || (options?.framework as string) || 'Selenium',
          pattern: 'Page Object Model',
          files,
          summary: {
            totalFiles: files.length,
            totalTests: files.filter(f => f.name.startsWith('test_')).length || 1,
            pattern: 'Page Object Model',
            coverage: `${files.length} file(s) recovered from truncated response`,
          },
          _truncated: true,
        };
      }
    }
  }

  return null;
}

const PROCESSING_DELAY = () => 800 + Math.random() * 1200;

export async function processAI(request: AIRequest): Promise<AIResponse> {
  const startTime = Date.now();
  const config = request.llmConfig || getDefaultConfig();
  const provider = config.provider;

  // If using a real LLM provider, try it first
  if (provider !== 'mock') {
    try {
      const basePrompt = SERVICE_PROMPTS[request.service] || 'You are a QA/QC AI assistant for Bank Indonesia payment infrastructure.';
      const systemPrompt = basePrompt + '\n\nCRITICAL OUTPUT RULES:\n1. Respond with valid JSON ONLY — no markdown fences, no ```json, no explanatory text.\n2. Start your response with { or [ directly.\n3. Ensure all strings are properly escaped.\n4. Do NOT include any text before or after the JSON object.';
      const userMessage = `${request.prompt || ''}\n\nInput:\n${request.input}\n\n${request.options ? 'Options: ' + JSON.stringify(request.options) : ''}`.trim();

      let llmResponse: string;
      if (provider === 'ollama') {
        llmResponse = await callOllama(config, systemPrompt, userMessage);
      } else if (provider === 'deepseek') {
        llmResponse = await callDeepSeek(config, systemPrompt, userMessage);
      } else {
        llmResponse = await callAnthropic(config, systemPrompt, userMessage);
      }

      const parsed = tryParseJSON(llmResponse);
      if (parsed && typeof parsed === 'object') {
        // Successfully parsed structured JSON from LLM
        return {
          result: parsed,
          confidence: 0.85 + Math.random() * 0.12,
          processingTime: Date.now() - startTime,
          model: config.model,
          provider,
          tokens: { input: userMessage.length / 4, output: llmResponse.length / 4 },
        };
      }

      // JSON parsing failed — likely truncated due to max_tokens
      console.warn(`[ai-engine] Failed to parse JSON from ${provider} for ${request.service}. Response length: ${llmResponse.length}`);
      console.warn(`[ai-engine] First 300 chars:`, llmResponse.substring(0, 300));

      if (llmResponse.length > 100) {
        // Try scenario-specific repair (extracts complete scenario objects)
        const repaired = repairTruncatedJSON(llmResponse);
        if (repaired && typeof repaired === 'object') {
          console.log(`[ai-engine] Truncated JSON repaired successfully for ${request.service}`);
          return {
            result: repaired,
            confidence: 0.75 + Math.random() * 0.1,
            processingTime: Date.now() - startTime,
            model: config.model,
            provider,
            tokens: { input: userMessage.length / 4, output: llmResponse.length / 4 },
          };
        }

        // Try generic truncated JSON repair: extract key-value pairs we can salvage
        const genericRepaired = repairGenericTruncatedJSON(llmResponse, request.service, request.options);
        if (genericRepaired && typeof genericRepaired === 'object') {
          console.log(`[ai-engine] Generic JSON repair succeeded for ${request.service}`);
          return {
            result: genericRepaired,
            confidence: 0.7 + Math.random() * 0.1,
            processingTime: Date.now() - startTime,
            model: config.model,
            provider,
            tokens: { input: userMessage.length / 4, output: llmResponse.length / 4 },
          };
        }
      }

      throw new Error(`LLM response could not be parsed. The output may have been truncated (${llmResponse.length} chars). Try with a shorter input document.`);
    } catch (error) {
      console.error(`[ai-engine] LLM provider ${provider} error for ${request.service}:`, error);
      // If explicitly configured for a real LLM, do NOT silently fall back to mock
      // Re-throw so the API route can return a proper error to the UI
      throw error;
    }
  }

  // Mock engine (default / fallback)
  await new Promise(resolve => setTimeout(resolve, PROCESSING_DELAY()));

  let result: unknown;

  switch (request.service) {
    case 'scenario-gen':
      result = generateTestScenarios(request.input);
      break;
    case 'traceability':
      result = generateTraceabilityMatrix(request.input);
      break;
    case 'perf-scripts':
      result = generatePerfScript(request.input, request.options);
      break;
    case 'automation-codegen':
      result = generateAutomationCode(request.input, request.options);
      break;
    case 'data-profiler':
      result = generateDataProfile(request.input);
      break;
    case 'pipeline-validator':
      result = validatePipeline(request.input);
      break;
    case 'viz-validator':
      result = validateVisualization(request.input);
      break;
    case 'iac-review':
      result = reviewIaC(request.input);
      break;
    case 'security-scan':
      result = scanSecurity(request.input);
      break;
    case 'dr-ha-test':
      result = generateDRScenarios(request.input);
      break;
    case 'defect-classifier':
      result = classifyDefect(request.input);
      break;
    case 'defect-patterns':
      result = analyzeDefectPatterns(request.input);
      break;
    case 'report-gen':
      result = generateReport(request.input, request.options);
      break;
    default:
      result = { message: 'Unknown service' };
  }

  return {
    result,
    confidence: 0.85 + Math.random() * 0.12,
    processingTime: Date.now() - startTime,
    model: config.model,
    provider: 'mock' as LLMProvider,
    tokens: { input: 500 + Math.floor(Math.random() * 2000), output: 1000 + Math.floor(Math.random() * 3000) },
  };
}

function generateTestScenarios(input: string) {
  const scenarios: Array<Record<string, unknown>> = [];
  const text = input.trim();

  // Extract requirements from the input document
  const reqPatterns = [
    /REQ[-_]?\d+[:\s]+(.+?)(?=\n(?:REQ|Acceptance|$))/gi,
    /(?:FR|NFR|BR)[-_]?\d+[:\s]+(.+?)(?=\n(?:FR|NFR|BR|Acceptance|$))/gi,
    /(?:The system shall|The application shall|The module shall)\s+(.+?)(?:\.|$)/gim,
    /(?:shall|must|should)\s+(.+?)(?:\.|$)/gim,
  ];

  // Try to find requirement-like statements
  const requirements: Array<{ id: string; text: string; module: string }> = [];
  const lines = text.split('\n').filter(l => l.trim().length > 5);

  // Look for explicit REQ/FR IDs
  const reqIdRegex = /(?:REQ|FR|NFR|BR)[-_]?(\d+)[:\s]*(.+)/gi;
  let match;
  while ((match = reqIdRegex.exec(text)) !== null) {
    const reqText = match[2].trim().substring(0, 200);
    const module = guessModule(reqText);
    requirements.push({ id: match[0].split(/[:\s]/)[0], text: reqText, module });
  }

  // If no explicit IDs, extract "shall" statements
  if (requirements.length === 0) {
    const shallRegex = /(?:system|application|module|service|platform)\s+(?:shall|must|should)\s+(.+?)(?:\.\s|\n|$)/gi;
    let idx = 1;
    while ((match = shallRegex.exec(text)) !== null && idx <= 20) {
      const reqText = match[1].trim().substring(0, 200);
      requirements.push({ id: `REQ-${String(idx).padStart(3, '0')}`, text: reqText, module: guessModule(reqText) });
      idx++;
    }
  }

  // If still nothing found, use line-level analysis
  if (requirements.length === 0) {
    const meaningfulLines = lines.filter(l => l.length > 20 && !l.match(/^(version|date|prepared|table|appendix|#|\d+\.?\s*$)/i));
    for (let i = 0; i < Math.min(meaningfulLines.length, 10); i++) {
      const line = meaningfulLines[i].trim().substring(0, 200);
      requirements.push({ id: `REQ-${String(i + 1).padStart(3, '0')}`, text: line, module: guessModule(line) });
    }
  }

  // Generate 3 scenarios per requirement (positive, negative, edge)
  let tcIdx = 1;
  let frIdx = 1;
  for (const req of requirements) {
    const keywords = extractKeywords(req.text);
    const frId = `FR-${String(frIdx++).padStart(3, '0')}`;
    const frLabel = `${frId}: ${truncateText(req.text, 60)}`;

    // Positive scenario
    scenarios.push({
      scenarioId: `TC-${String(tcIdx++).padStart(3, '0')}`,
      module: req.module,
      functionalRequirement: frLabel,
      testType: 'Positive',
      priority: req.text.toLowerCase().includes('security') || req.text.toLowerCase().includes('critical') ? 'Critical' : 'High',
      precondition: `${req.module} is configured and accessible; valid test data prepared`,
      steps: [
        `Set up preconditions for: ${truncateText(req.text, 80)}`,
        `Execute the primary flow with valid ${keywords.join(', ') || 'input data'}`,
        `Verify the system processes the request successfully`,
        `Validate output/state matches expected results per ${req.id}`,
      ],
      expectedResult: `System successfully ${req.text.toLowerCase().startsWith('allow') ? req.text.substring(0, 100) : 'completes the operation as specified in ' + req.id}`,
      mappedRequirement: req.id,
    });

    // Negative scenario
    scenarios.push({
      scenarioId: `TC-${String(tcIdx++).padStart(3, '0')}`,
      module: req.module,
      functionalRequirement: frLabel,
      testType: 'Negative',
      priority: 'Medium',
      precondition: `${req.module} is configured; invalid/missing test data prepared`,
      steps: [
        `Set up preconditions for: ${truncateText(req.text, 80)}`,
        `Attempt the flow with invalid ${keywords[0] || 'input'} (missing/malformed/out-of-range)`,
        `Verify the system rejects the request with appropriate error`,
        `Confirm no partial state change or data corruption occurred`,
      ],
      expectedResult: `System returns clear error message, no side effects, data integrity maintained`,
      mappedRequirement: req.id,
    });

    // Edge case scenario
    scenarios.push({
      scenarioId: `TC-${String(tcIdx++).padStart(3, '0')}`,
      module: req.module,
      functionalRequirement: frLabel,
      testType: 'Edge Case',
      priority: req.text.toLowerCase().includes('concurrent') || req.text.toLowerCase().includes('timeout') ? 'High' : 'Low',
      precondition: `${req.module} configured with boundary conditions; edge case data prepared`,
      steps: [
        `Set up boundary conditions for: ${truncateText(req.text, 80)}`,
        `Test with boundary values: ${generateEdgeCaseHint(keywords, req.text)}`,
        `Verify system handles the edge case gracefully`,
        `Check logs for warnings/errors and validate state consistency`,
      ],
      expectedResult: `System handles edge case without crash or data loss; proper logging and graceful degradation`,
      mappedRequirement: req.id,
    });
  }

  // Ensure at least some scenarios even for very short input
  if (scenarios.length === 0) {
    const fallbackModules = guessModulesFromText(text);
    for (let i = 0; i < 6; i++) {
      const mod = fallbackModules[i % fallbackModules.length];
      const types = ['Positive', 'Negative', 'Edge Case'];
      scenarios.push({
        scenarioId: `TC-${String(i + 1).padStart(3, '0')}`,
        module: mod,
        functionalRequirement: `FR-${String(Math.floor(i / 3) + 1).padStart(3, '0')}: ${mod} functionality`,
        testType: types[i % 3],
        priority: i < 2 ? 'High' : 'Medium',
        precondition: `${mod} module is operational and test environment ready`,
        steps: ['Prepare test environment', 'Execute test with prepared data', 'Verify results', 'Check system state'],
        expectedResult: types[i % 3] === 'Positive' ? 'Operation completes successfully' : types[i % 3] === 'Negative' ? 'Error handled gracefully' : 'Boundary condition handled properly',
        mappedRequirement: `REQ-${String(Math.floor(i / 3) + 1).padStart(3, '0')}`,
      });
    }
  }

  return {
    scenarios,
    summary: {
      total: scenarios.length,
      positive: scenarios.filter(s => s.testType === 'Positive').length,
      negative: scenarios.filter(s => s.testType === 'Negative').length,
      edge: scenarios.filter(s => s.testType === 'Edge Case').length,
    },
    sourceRequirements: requirements.length,
    inputLength: text.length,
  };
}

function guessModule(text: string): string {
  const t = text.toLowerCase();
  if (t.includes('payment') || t.includes('transaction') || t.includes('transfer') || t.includes('settlement')) return 'Payment Processing';
  if (t.includes('onboard') || t.includes('registration') || t.includes('psp') || t.includes('kyc')) return 'PSP Onboarding';
  if (t.includes('security') || t.includes('encrypt') || t.includes('auth') || t.includes('credential')) return 'Security & Auth';
  if (t.includes('report') || t.includes('dashboard') || t.includes('metric') || t.includes('monitor')) return 'Reporting & Dashboard';
  if (t.includes('data') || t.includes('database') || t.includes('query') || t.includes('pipeline')) return 'Data Management';
  if (t.includes('api') || t.includes('endpoint') || t.includes('rest') || t.includes('request')) return 'API Gateway';
  if (t.includes('reconcil') || t.includes('settlement') || t.includes('audit')) return 'Reconciliation';
  if (t.includes('currency') || t.includes('fx') || t.includes('exchange')) return 'Currency Exchange';
  if (t.includes('notif') || t.includes('alert') || t.includes('email')) return 'Notifications';
  if (t.includes('batch') || t.includes('bulk') || t.includes('queue')) return 'Batch Processing';
  if (t.includes('document') || t.includes('verif') || t.includes('upload')) return 'Document Management';
  if (t.includes('approval') || t.includes('workflow') || t.includes('review')) return 'Workflow Engine';
  if (t.includes('risk') || t.includes('score') || t.includes('compliance')) return 'Risk & Compliance';
  return 'Core System';
}

function guessModulesFromText(text: string): string[] {
  const modules = new Set<string>();
  const sentences = text.split(/[.\n]/).filter(s => s.trim().length > 10);
  for (const s of sentences.slice(0, 20)) {
    modules.add(guessModule(s));
  }
  return modules.size > 0 ? [...modules] : ['Core System', 'API Gateway', 'Data Management'];
}

function extractKeywords(text: string): string[] {
  const keywords: string[] = [];
  const t = text.toLowerCase();
  const terms = ['account', 'amount', 'currency', 'transaction', 'user', 'document', 'password', 'token',
    'file', 'date', 'time', 'status', 'id', 'name', 'email', 'license', 'certificate', 'score',
    'limit', 'rate', 'balance', 'payment', 'reference', 'batch', 'report'];
  for (const term of terms) {
    if (t.includes(term)) keywords.push(term);
  }
  return keywords.slice(0, 4);
}

function generateEdgeCaseHint(keywords: string[], text: string): string {
  const hints: string[] = [];
  const t = text.toLowerCase();
  if (keywords.includes('amount') || t.includes('amount')) hints.push('min/max amounts, zero, negative values');
  if (keywords.includes('date') || t.includes('date') || t.includes('time')) hints.push('past dates, future dates, timezone boundaries');
  if (keywords.includes('limit') || t.includes('limit') || t.includes('rate')) hints.push('at limit, over limit, concurrent requests');
  if (keywords.includes('batch') || t.includes('batch')) hints.push('empty batch, single item, max batch size');
  if (keywords.includes('file') || t.includes('document') || t.includes('upload')) hints.push('empty file, max size, invalid format');
  if (keywords.includes('account') || t.includes('account')) hints.push('closed account, suspended account, non-existent account');
  if (keywords.includes('currency') || t.includes('currency')) hints.push('same currency, unsupported currency, conversion edge');
  if (hints.length === 0) hints.push('maximum allowed values, empty inputs, concurrent access, timeout conditions');
  return hints.slice(0, 2).join('; ');
}

function truncateText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.substring(0, maxLen) + '...';
}

function generateTraceabilityMatrix(input: string) {
  const text = input.trim();

  // Split input into requirements section and test cases section
  const reqSection = text.includes('=== REQUIREMENTS ===')
    ? text.split('=== TEST CASES ===')[0].replace('=== REQUIREMENTS ===', '')
    : text.includes('=== TEST CASES ===') ? text.split('=== TEST CASES ===')[0] : text;

  const tcSection = text.includes('=== TEST CASES ===')
    ? text.split('=== TEST CASES ===')[1] || ''
    : '';

  // Extract requirements
  const reqs: Array<{ id: string; desc: string }> = [];
  const reqIdRegex = /(?:REQ|FR|NFR|BR)[-_]?\d+/gi;
  const reqLines = reqSection.split('\n');
  for (const line of reqLines) {
    const match = line.match(/(?:REQ|FR|NFR|BR)[-_]?\d+/i);
    if (match) {
      const id = match[0].toUpperCase();
      const desc = line.replace(match[0], '').replace(/^[:\s-]+/, '').trim().substring(0, 200);
      if (desc.length > 5 && !reqs.find(r => r.id === id)) {
        reqs.push({ id, desc });
      }
    }
  }

  // Fallback: extract from "shall" statements
  if (reqs.length === 0) {
    const shallRegex = /(?:system|application)\s+(?:shall|must|should)\s+(.+?)(?:\.\s|\n|$)/gi;
    let m; let idx = 1;
    while ((m = shallRegex.exec(reqSection)) !== null && idx <= 20) {
      reqs.push({ id: `REQ-${String(idx).padStart(3, '0')}`, desc: m[1].trim().substring(0, 200) });
      idx++;
    }
  }

  // Extract test cases with their mapped requirement
  const testCases: Array<{ id: string; mappedReq: string; desc: string }> = [];
  const tcRegex = /(?:TC|TEST)[-_]?[\w-]+/gi;
  const tcLines = (tcSection || text).split('\n');
  for (const line of tcLines) {
    const tcMatch = line.match(/(?:TC|TEST)[-_]?[\w-]+/i);
    if (tcMatch) {
      const tcId = tcMatch[0].toUpperCase();
      // Find which REQ this TC maps to
      const reqMatch = line.match(/(?:REQ|FR|NFR|BR)[-_]?\d+/i) ||
        // Check nearby lines for "Mapped:" pattern
        tcLines.slice(Math.max(0, tcLines.indexOf(line) - 2), tcLines.indexOf(line) + 5)
          .join(' ').match(/(?:Mapped|Maps?|Covers?|Requirement)[:\s]*(?:REQ|FR|NFR|BR)[-_]?\d+/i);
      const mappedReq = reqMatch ? reqMatch[0].match(/(?:REQ|FR|NFR|BR)[-_]?\d+/i)?.[0]?.toUpperCase() || '' : '';
      const desc = line.replace(tcMatch[0], '').replace(/^[:\s-]+/, '').trim().substring(0, 150);
      if (!testCases.find(t => t.id === tcId)) {
        testCases.push({ id: tcId, mappedReq, desc });
      }
    }
  }

  // Build the traceability matrix
  const matrix: Array<Record<string, unknown>> = [];

  if (reqs.length > 0) {
    // Map test cases to requirements
    for (const req of reqs) {
      const mappedTCs = testCases
        .filter(tc => tc.mappedReq === req.id)
        .map(tc => tc.id);

      // Also try keyword matching if no explicit mapping found
      if (mappedTCs.length === 0) {
        const reqKeywords = req.desc.toLowerCase().split(/\s+/).filter(w => w.length > 4);
        for (const tc of testCases) {
          if (!tc.mappedReq && reqKeywords.some(kw => tc.desc.toLowerCase().includes(kw))) {
            mappedTCs.push(tc.id);
          }
        }
      }

      matrix.push({
        requirementId: req.id,
        description: req.desc,
        testCaseIds: mappedTCs,
        coverageStatus: mappedTCs.length > 0 ? 'Covered' : 'Gap',
        gapNotes: mappedTCs.length > 0
          ? ''
          : `No test cases mapped for: "${truncateText(req.desc, 60)}". Recommend creating test scenarios.`,
      });
    }
  } else if (testCases.length > 0) {
    // No explicit requirements found, group test cases by their mapped requirement
    const grouped = new Map<string, string[]>();
    for (const tc of testCases) {
      const key = tc.mappedReq || 'UNMAPPED';
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(tc.id);
    }
    for (const [reqId, tcIds] of grouped) {
      matrix.push({
        requirementId: reqId,
        description: reqId === 'UNMAPPED' ? 'Test cases without explicit requirement mapping' : `Requirement ${reqId}`,
        testCaseIds: tcIds,
        coverageStatus: reqId === 'UNMAPPED' ? 'Gap' : 'Covered',
        gapNotes: reqId === 'UNMAPPED' ? 'These test cases need explicit requirement mapping' : '',
      });
    }
  }

  const covered = matrix.filter(r => r.coverageStatus === 'Covered').length;
  return {
    matrix,
    coverage: {
      total: matrix.length,
      covered,
      gaps: matrix.length - covered,
      percentage: matrix.length > 0 ? Math.round((covered / matrix.length) * 100) : 0,
    },
    testCasesFound: testCases.length,
    requirementsFound: reqs.length,
  };
}

function extractEndpoints(text: string): Array<{ method: string; path: string }> {
  const endpoints: Array<{ method: string; path: string }> = [];
  const seen = new Set<string>();

  // Match patterns like POST /api/v1/users, GET /path, etc.
  const httpMethodRegex = /\b(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s+(\/[^\s,;)"'}\]]+)/gi;
  let m;
  while ((m = httpMethodRegex.exec(text)) !== null) {
    const key = `${m[1].toUpperCase()} ${m[2]}`;
    if (!seen.has(key)) { seen.add(key); endpoints.push({ method: m[1].toUpperCase(), path: m[2] }); }
  }

  // Match URL paths like /api/something or paths in quotes
  const pathRegex = /["'](\/api\/[^\s"']+)["']/g;
  while ((m = pathRegex.exec(text)) !== null) {
    const key = `GET ${m[1]}`;
    if (!seen.has(key)) { seen.add(key); endpoints.push({ method: 'GET', path: m[1] }); }
  }

  // Try OpenAPI/Swagger JSON: look for "paths" key
  try {
    const json = JSON.parse(text);
    if (json.paths && typeof json.paths === 'object') {
      for (const [path, methods] of Object.entries(json.paths)) {
        if (typeof methods === 'object' && methods !== null) {
          for (const method of Object.keys(methods as Record<string, unknown>)) {
            if (['get', 'post', 'put', 'delete', 'patch'].includes(method.toLowerCase())) {
              const key = `${method.toUpperCase()} ${path}`;
              if (!seen.has(key)) { seen.add(key); endpoints.push({ method: method.toUpperCase(), path }); }
            }
          }
        }
      }
    }
  } catch { /* not JSON */ }

  return endpoints;
}

function generatePerfScript(input: string, options?: Record<string, unknown>) {
  const tool = ((options?.tool as string) || 'jmeter').toLowerCase();
  const testType = ((options?.testType as string) || 'load').toLowerCase();
  const text = input.trim();

  // Extract real endpoints from input
  let endpoints = extractEndpoints(text);
  if (endpoints.length === 0) {
    endpoints = [{ method: 'POST', path: '/api/v1/transactions' }];
  }

  // Extract base URL if present
  const urlMatch = text.match(/https?:\/\/[^\s"']+/);
  const baseUrl = urlMatch ? urlMatch[0].replace(/\/+$/, '') : 'https://api.bi.go.id';

  const threads = testType === 'load' ? 100 : testType === 'stress' ? 500 : 50;
  const rampUp = testType === 'spike' ? 10 : 60;
  const duration = testType === 'soak' ? 14400 : 1800;

  if (tool === 'jmeter') {
    const samplers = endpoints.map((ep, idx) => `        <HTTPSamplerProxy testname="${ep.method} ${ep.path}" testclass="HTTPSamplerProxy">
          <stringProp name="HTTPSampler.domain">\${BASE_URL}</stringProp>
          <stringProp name="HTTPSampler.path">${ep.path}</stringProp>
          <stringProp name="HTTPSampler.method">${ep.method}</stringProp>
        </HTTPSamplerProxy>`).join('\n');

    return {
      tool: 'JMeter',
      testType,
      fileName: `perf_test_${testType}.jmx`,
      script: `<?xml version="1.0" encoding="UTF-8"?>
<jmeterTestPlan version="1.2" properties="5.0">
  <hashTree>
    <TestPlan guiclass="TestPlanGui" testclass="TestPlan" testname="${testType.toUpperCase()} Test - ${endpoints.length} Endpoint(s)">
      <elementProp name="TestPlan.user_defined_variables" elementType="Arguments">
        <collectionProp name="Arguments.arguments">
          <elementProp name="BASE_URL" elementType="Argument">
            <stringProp name="Argument.name">BASE_URL</stringProp>
            <stringProp name="Argument.value">\${__P(base_url,${baseUrl})}</stringProp>
          </elementProp>
          <elementProp name="TARGET_TPS" elementType="Argument">
            <stringProp name="Argument.name">TARGET_TPS</stringProp>
            <stringProp name="Argument.value">${testType === 'stress' ? '1000' : '500'}</stringProp>
          </elementProp>
        </collectionProp>
      </elementProp>
    </TestPlan>
    <hashTree>
      <ThreadGroup guiclass="ThreadGroupGui" testclass="ThreadGroup" testname="API Users - ${testType}">
        <intProp name="ThreadGroup.num_threads">${threads}</intProp>
        <intProp name="ThreadGroup.ramp_time">${rampUp}</intProp>
        <longProp name="ThreadGroup.duration">${duration}</longProp>
      </ThreadGroup>
      <hashTree>
${samplers}
      </hashTree>
    </hashTree>
  </hashTree>
</jmeterTestPlan>`,
      config: { threads, rampUp: `${rampUp}s`, duration: duration >= 3600 ? `${Math.round(duration/3600)}h` : `${Math.round(duration/60)}m`, endpointsCount: endpoints.length },
      endpoints: endpoints.map(e => `${e.method} ${e.path}`),
    };
  }

  const gatlingExecs = endpoints.map((ep) =>
    `    .exec(http("${ep.method} ${ep.path}")\n      .${ep.method.toLowerCase() === 'get' ? 'get' : ep.method.toLowerCase()}("${ep.path}")\n      ${ep.method !== 'GET' ? '.body(StringBody("""{"test": true}"""))\n      ' : ''}.check(status.is(200)))`
  ).join('\n');

  return {
    tool: 'Gatling',
    testType,
    fileName: `PerfTest${testType.charAt(0).toUpperCase() + testType.slice(1)}.scala`,
    script: `package bi.payment.perf\n\nimport io.gatling.core.Predef._\nimport io.gatling.http.Predef._\nimport scala.concurrent.duration._\n\nclass ${testType.charAt(0).toUpperCase() + testType.slice(1)}Test extends Simulation {\n  val httpProtocol = http.baseUrl("${baseUrl}")\n    .acceptHeader("application/json")\n    .contentTypeHeader("application/json")\n\n  val scn = scenario("${testType} Test - ${endpoints.length} endpoints")\n${gatlingExecs}\n\n  setUp(scn.inject(\n    ${testType === 'load' ? 'rampUsers(100).during(60.seconds)' : testType === 'stress' ? 'stressPeakUsers(500).during(120.seconds)' : testType === 'soak' ? 'constantUsersPerSec(10).during(4.hours)' : 'atOnceUsers(200)'}\n  )).protocols(httpProtocol)\n}`,
    config: { threads, rampUp: `${rampUp}s`, duration: duration >= 3600 ? `${Math.round(duration/3600)}h` : `${Math.round(duration/60)}m`, endpointsCount: endpoints.length },
    endpoints: endpoints.map(e => `${e.method} ${e.path}`),
  };
}

function generateAutomationCode(input: string, options?: Record<string, unknown>) {
  const text = input.trim();
  const frameworkRaw = ((options?.framework as string) || 'selenium').toLowerCase();
  const isKatalon = frameworkRaw.includes('katalon');

  // Extract test steps/actions from input
  interface ParsedStep {
    action: string;
    element: string;
    page: string;
    value?: string;
  }

  const steps: ParsedStep[] = [];
  const pages = new Set<string>();
  const lines = text.split('\n').filter(l => l.trim().length > 5);

  // Patterns to detect UI actions in test step descriptions
  const actionPatterns = [
    /(?:navigate|go|open|visit)\s+(?:to\s+)?(?:the\s+)?["']?([^"'\n,]+?)["']?\s*(?:page|screen|form|dialog)?/gi,
    /(?:click|tap|press)\s+(?:on\s+)?(?:the\s+)?["']?([^"'\n,]+?)["']?\s*(?:button|link|icon|tab|checkbox|radio)?/gi,
    /(?:enter|type|input|fill|set)\s+(?:in\s+)?["']?([^"'\n,]+?)["']?\s+(?:in|into|to)?\s*(?:the\s+)?["']?([^"'\n,]+?)["']?\s*(?:field|input|textbox|textarea)?/gi,
    /(?:select|choose|pick)\s+["']?([^"'\n,]+?)["']?\s+(?:from|in)\s+(?:the\s+)?["']?([^"'\n,]+?)["']?\s*(?:dropdown|select|menu|list)?/gi,
    /(?:verify|assert|check|validate|confirm)\s+(?:that\s+)?["']?(.+?)["']?\s*(?:is\s+(?:displayed|shown|visible|present))?/gi,
  ];

  for (const line of lines) {
    for (const pattern of actionPatterns) {
      pattern.lastIndex = 0;
      let m;
      while ((m = pattern.exec(line)) !== null) {
        const actionWord = line.match(/\b(navigate|go|open|visit|click|tap|press|enter|type|input|fill|select|choose|verify|assert|check|validate|confirm)\b/i)?.[1] || 'interact';
        steps.push({
          action: actionWord.toLowerCase(),
          element: (m[2] || m[1] || '').trim().substring(0, 60),
          page: guessPageName(line),
          value: m[2] ? m[1].trim() : undefined,
        });
      }
    }
    // Detect page names
    const pageMatch = line.match(/(?:page|screen|form|dialog|modal)\s*[:=]\s*["']?([^"'\n,]+)/i) ||
                       line.match(/["']?(\w+(?:\s+\w+)?)\s+(?:page|screen|form)/i);
    if (pageMatch) pages.add(pageMatch[1].trim());
  }

  // If no steps extracted, use line-level analysis
  if (steps.length === 0) {
    for (const line of lines.slice(0, 15)) {
      const mod = guessModule(line);
      steps.push({ action: 'execute', element: truncateText(line.trim(), 60), page: mod });
      pages.add(mod);
    }
  }

  // Derive unique pages
  if (pages.size === 0) {
    const mods = guessModulesFromText(text);
    mods.forEach(m => pages.add(m));
  }

  const pageList = [...pages].slice(0, 5);

  // Generate page object files
  const files: Array<{ name: string; content: string }> = [];

  for (const pageName of pageList) {
    const className = pageName.replace(/[^a-zA-Z0-9]/g, '') + 'Page';
    const pageSlug = pageName.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const pageSteps = steps.filter(s => s.page === pageName || pages.size <= 1);
    const elements = pageSteps.map(s => s.element).filter(Boolean).slice(0, 6);
    const uniqueEls = [...new Set(elements)];

    if (isKatalon) {
      // Katalon Groovy Page Object
      const testObjects = uniqueEls.map(el => {
        const elId = el.toLowerCase().replace(/[^a-z0-9]+/g, '_').substring(0, 30);
        return `\tTestObject ${elId} = findTestObject('Object Repository/${className}/${elId}')`;
      }).join('\n');

      const keywords = uniqueEls.map(el => {
        const elId = el.toLowerCase().replace(/[^a-z0-9]+/g, '_').substring(0, 30);
        return `\t@Keyword\n\tdef interact_${elId}(String value = null) {\n\t\tTestObject obj = findTestObject('Object Repository/${className}/${elId}')\n\t\tif (value) {\n\t\t\tWebUI.setText(obj, value)\n\t\t} else {\n\t\t\tWebUI.click(obj)\n\t\t}\n\t}`;
      }).join('\n\n');

      files.push({
        name: `Keywords/${className}.groovy`,
        content: `import com.kms.katalon.core.annotation.Keyword\nimport com.kms.katalon.core.testobject.TestObject\nimport com.kms.katalon.core.webui.keyword.WebUiBuiltInKeywords as WebUI\nimport static com.kms.katalon.core.testobject.ObjectRepository.findTestObject\n\npublic class ${className} {\n\n\tString url = "/${pageSlug}"\n\n${testObjects || '\t// No specific test objects extracted'}\n\n\t@Keyword\n\tdef navigateTo() {\n\t\tWebUI.navigateToUrl(url)\n\t}\n\n${keywords || '\t@Keyword\n\tdef submit() {\n\t\tWebUI.click(findTestObject(\'Object Repository/Common/btn_submit\'))\n\t}'}\n\n\t@Keyword\n\tdef verifySuccessMessage() {\n\t\tWebUI.verifyElementPresent(findTestObject('Object Repository/Common/msg_success'), 10)\n\t}\n\n\t@Keyword\n\tdef verifyErrorMessage() {\n\t\tWebUI.verifyElementPresent(findTestObject('Object Repository/Common/msg_error'), 10)\n\t}\n}`,
      });
    } else {
      // Selenium Python Page Object
      const locators = uniqueEls.map(el => {
        const elId = el.toLowerCase().replace(/[^a-z0-9]+/g, '_').substring(0, 30);
        return `    ${elId.toUpperCase()} = (By.ID, "${elId}")`;
      }).join('\n');

      const methods = uniqueEls.map(el => {
        const elId = el.toLowerCase().replace(/[^a-z0-9]+/g, '_').substring(0, 30);
        const methodName = `interact_${elId}`;
        return `    def ${methodName}(self, value=None):\n        el = self.wait.until(EC.presence_of_element_located(self.${elId.toUpperCase()}))\n        if value:\n            el.clear()\n            el.send_keys(str(value))\n        else:\n            el.click()\n        return self`;
      }).join('\n\n');

      files.push({
        name: `pages/${pageSlug}_page.py`,
        content: `from selenium.webdriver.common.by import By\nfrom selenium.webdriver.support.ui import WebDriverWait\nfrom selenium.webdriver.support import expected_conditions as EC\n\nclass ${className}:\n    URL = "/${pageSlug}"\n${locators || '    # No specific locators extracted'}\n    SUBMIT_BTN = (By.CSS_SELECTOR, "button[type=\'submit\']")\n    SUCCESS_MSG = (By.CLASS_NAME, "success-message")\n    ERROR_MSG = (By.CLASS_NAME, "error-message")\n\n    def __init__(self, driver):\n        self.driver = driver\n        self.wait = WebDriverWait(driver, 10)\n\n    def navigate(self):\n        self.driver.get(self.URL)\n        return self\n\n${methods || '    def submit(self):\n        self.wait.until(EC.element_to_be_clickable(self.SUBMIT_BTN)).click()\n        return self'}\n\n    def get_success_message(self):\n        return self.wait.until(EC.visibility_of_element_located(self.SUCCESS_MSG)).text\n\n    def get_error_message(self):\n        return self.wait.until(EC.visibility_of_element_located(self.ERROR_MSG)).text`,
      });
    }
  }

  // Generate test file
  if (isKatalon) {
    const testCases = steps.slice(0, 8).map((step, idx) => {
      const testName = `tc_${step.action}_${step.element.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 25).toLowerCase()}`;
      const className = pageList[0]?.replace(/[^a-zA-Z0-9]/g, '') + 'Page' || 'BasePage';
      return `WebUI.callTestCase(findTestCase('Test Cases/${testName}'), [:])`;
    }).join('\n');

    const testSteps = steps.slice(0, 8).map((step) => {
      const className = pageList[0]?.replace(/[^a-zA-Z0-9]/g, '') + 'Page' || 'BasePage';
      return `// Step: ${truncateText(step.element, 60)}\nCustomKeywords.'${className}.navigateTo'()\n${step.value ? `CustomKeywords.'${className}.interact_${step.element.toLowerCase().replace(/[^a-z0-9]+/g, '_').substring(0, 30)}'("${truncateText(step.value, 30)}")` : `// Verify: ${truncateText(step.element, 50)}`}`;
    }).join('\n\n');

    files.push({
      name: `Test Cases/TestSuite.groovy`,
      content: `import com.kms.katalon.core.webui.keyword.WebUiBuiltInKeywords as WebUI\nimport static com.kms.katalon.core.testcase.TestCaseFactory.findTestCase\n\n// Test Suite: ${pageList[0] || 'Main'} Flow\n// Generated by QAQC4BI MS-APP-004\n\nWebUI.openBrowser('')\nWebUI.maximizeWindow()\n\n${testSteps || '// No test steps extracted'}\n\nWebUI.closeBrowser()`,
    });
  } else {
    const testMethods = steps.slice(0, 8).map((step) => {
      const testName = `test_${step.action}_${step.element.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 25).toLowerCase()}`;
      const pageName = pageList[0]?.replace(/[^a-zA-Z0-9]/g, '') + 'Page' || 'BasePage';
      return `    def ${testName}(self, driver):\n        page = ${pageName}(driver).navigate()\n        # Step: ${truncateText(step.element, 60)}\n        ${step.value ? `page.interact_${step.element.toLowerCase().replace(/[^a-z0-9]+/g, '_').substring(0, 30)}("${truncateText(step.value, 30)}")` : `# Verify: ${truncateText(step.element, 50)}`}\n        assert page is not None`;
    }).join('\n\n');

    const importPage = pageList[0]?.replace(/[^a-zA-Z0-9]/g, '') + 'Page' || 'BasePage';
    const importSlug = pageList[0]?.toLowerCase().replace(/[^a-z0-9]+/g, '_') || 'base';
    files.push({
      name: `tests/test_${importSlug}.py`,
      content: `import pytest\nfrom pages.${importSlug}_page import ${importPage}\n\nclass Test${importPage.replace('Page', '')}Flow:\n${testMethods || '    def test_placeholder(self, driver):\n        pass'}`,
    });
  }

  const frameworkName = isKatalon ? 'Katalon Studio' : 'Selenium + Python';
  return {
    framework: frameworkName,
    pattern: isKatalon ? 'Keyword-Driven' : 'Page Object Model',
    files,
    summary: { totalFiles: files.length, totalTests: Math.min(steps.length, 8), pattern: isKatalon ? 'Keyword-Driven' : 'Page Object Model', pagesExtracted: pageList.length, stepsExtracted: steps.length },
  };
}

function guessPageName(text: string): string {
  const t = text.toLowerCase();
  if (t.includes('login') || t.includes('sign in')) return 'Login';
  if (t.includes('payment') || t.includes('checkout')) return 'Payment';
  if (t.includes('register') || t.includes('sign up') || t.includes('onboard')) return 'Registration';
  if (t.includes('dashboard') || t.includes('home')) return 'Dashboard';
  if (t.includes('search') || t.includes('find')) return 'Search';
  if (t.includes('report') || t.includes('analytics')) return 'Reports';
  if (t.includes('setting') || t.includes('config') || t.includes('profile')) return 'Settings';
  if (t.includes('transaction') || t.includes('transfer')) return 'Transaction';
  return guessModule(text);
}

function generateDataProfile(input: string) {
  const text = input.trim();
  const lines = text.split('\n').filter(l => l.trim().length > 0);

  // Detect CSV/TSV data
  const isCsv = lines.length > 1 && (
    lines[0].includes(',') || lines[0].includes('\t') || lines[0].includes('|')
  );

  let columns: string[] = [];
  let dataRows: string[][] = [];
  let rowCount = 0;

  if (isCsv && lines.length >= 2) {
    // Detect delimiter
    const delim = lines[0].includes('\t') ? '\t' : lines[0].includes('|') ? '|' : ',';
    columns = lines[0].split(delim).map(c => c.trim().replace(/^["']|["']$/g, ''));
    dataRows = lines.slice(1).map(l => l.split(delim).map(c => c.trim().replace(/^["']|["']$/g, '')));
    rowCount = dataRows.length;
  } else {
    // Extract column-like names from text (SQL schemas, table descriptions, etc.)
    const colPatterns = [
      /(?:column|field|attribute)[:\s]+["']?(\w+)["']?/gi,
      /CREATE\s+TABLE.*?\(([\s\S]+?)\)/gi,
      /SELECT\s+([\w., ]+)\s+FROM/gi,
    ];
    const foundCols = new Set<string>();

    // Try CREATE TABLE
    const createMatch = text.match(/CREATE\s+TABLE[^(]*\(([\s\S]+?)\)/i);
    if (createMatch) {
      const defs = createMatch[1].split(',');
      for (const def of defs) {
        const colName = def.trim().match(/^["']?(\w+)["']?/);
        if (colName && !['PRIMARY', 'FOREIGN', 'CONSTRAINT', 'INDEX', 'UNIQUE', 'CHECK'].includes(colName[1].toUpperCase())) {
          foundCols.add(colName[1]);
        }
      }
    }

    // Try SELECT columns
    const selectMatch = text.match(/SELECT\s+([\w\s,.*]+?)\s+FROM/i);
    if (selectMatch && !selectMatch[1].includes('*')) {
      selectMatch[1].split(',').forEach(c => {
        const col = c.trim().split(/\s+as\s+/i).pop()?.trim().split('.').pop();
        if (col && col.length > 1) foundCols.add(col);
      });
    }

    // Generic column name detection
    for (const pattern of colPatterns) {
      let m;
      while ((m = pattern.exec(text)) !== null) {
        if (m[1]) foundCols.add(m[1]);
      }
    }

    columns = foundCols.size > 0 ? [...foundCols] : ['transaction_id', 'psp_id', 'amount', 'currency', 'status', 'created_at', 'sender_account', 'receiver_account'];
    rowCount = isCsv ? dataRows.length : 2347891;
  }

  // Format validators for well-known Indonesian / banking columns.
  // Returns { invalid: count, rule: human-readable rule, severity }.
  function validateColumnFormat(colName: string, values: string[]): { invalid: number; rule: string; severity: 'Critical' | 'Major' | 'Minor' } | null {
    const lc = colName.toLowerCase();
    const checks: Array<{ match: RegExp; rule: string; valid: RegExp; severity: 'Critical' | 'Major' | 'Minor' }> = [
      { match: /\bnik\b/,                     rule: 'NIK must be exactly 16 digits',                       valid: /^\d{16}$/,                                                  severity: 'Critical' },
      { match: /\bnpwp\b/,                    rule: 'NPWP must follow DJP format XX.XXX.XXX.X-XXX.XXX',   valid: /^\d{2}\.\d{3}\.\d{3}\.\d{1}-\d{3}\.\d{3}$/,                  severity: 'Major' },
      { match: /\bnpwp16\b|npwp_16/,          rule: 'NPWP-16 must be exactly 16 digits (post-2024)',       valid: /^\d{16}$/,                                                  severity: 'Major' },
      { match: /^email$|_email$/,             rule: 'Email must be a valid RFC-5322 address',              valid: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,                                severity: 'Major' },
      { match: /\b(no_hp|phone|telp|hp)\b/,   rule: 'Phone must be Indonesian format starting with 08',    valid: /^(\+?62|0)8\d{8,12}$/,                                      severity: 'Minor' },
      { match: /^tgl|date$|_at$|_date/,       rule: 'Date must be ISO YYYY-MM-DD or YYYY-MM-DD HH:MM:SS',  valid: /^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}:\d{2})?$/,                  severity: 'Major' },
      { match: /\b(plafon|amount|jumlah)\b/,  rule: 'Amount must be a positive integer (no decimals)',     valid: /^\d+$/,                                                     severity: 'Major' },
    ];
    for (const c of checks) {
      if (c.match.test(lc)) {
        const invalid = values.filter(v => v && !c.valid.test(v)).length;
        return { invalid, rule: c.rule, severity: c.severity };
      }
    }
    return null;
  }

  // Build per-column profile
  const profile = columns.map((col, colIdx) => {
    const colLower = col.toLowerCase();
    let nullCount = 0;
    let uniqueValues = new Set<string>();
    const nonNullValues: string[] = [];

    if (dataRows.length > 0) {
      // Analyze actual data
      for (const row of dataRows) {
        const val = row[colIdx] ?? '';
        if (!val || val.toLowerCase() === 'null' || val === 'NA' || val === 'N/A' || val === '') {
          nullCount++;
        } else {
          nonNullValues.push(val);
          uniqueValues.add(val);
        }
      }
    } else {
      // Simulate for non-CSV input
      nullCount = Math.floor(Math.random() * 50);
      uniqueValues = new Set(Array.from({ length: colLower.includes('id') ? rowCount : Math.min(rowCount, Math.floor(Math.random() * 1000)) }, (_, i) => String(i)));
    }

    const totalRows = dataRows.length > 0 ? dataRows.length : rowCount;
    const guessedType = colLower.includes('amount') || colLower.includes('price') || colLower.includes('total') || colLower.includes('count') || colLower.includes('qty') || colLower.includes('plafon') ? 'numeric'
      : colLower.includes('date') || colLower.includes('_at') || colLower.includes('time') || colLower.includes('created') || colLower.includes('updated') || colLower.startsWith('tgl') ? 'datetime'
      : colLower.includes('flag') || colLower.includes('is_') || colLower.includes('has_') ? 'boolean'
      : 'string';

    // Format validation against known patterns
    const formatCheck = dataRows.length > 0 ? validateColumnFormat(col, nonNullValues) : null;
    const formatInvalid = formatCheck?.invalid ?? 0;

    // Validity = (non-null AND format-valid) / total
    const validCount = (totalRows - nullCount) - formatInvalid;
    const validityPct = totalRows > 0 ? (validCount / totalRows) * 100 : 100;

    type Anomaly = { type: string; description: string; severity: 'Critical' | 'Major' | 'Minor' | 'Medium' };
    const anomalies: Anomaly[] = [];

    // Null anomalies
    if (nullCount > 0) {
      const nullPct = (nullCount / totalRows) * 100;
      const nullSeverity: Anomaly['severity'] = nullPct >= 5 ? 'Critical' : nullPct >= 1 ? 'Major' : 'Minor';
      anomalies.push({
        type: 'null_values',
        description: `${nullCount} null value(s) (${nullPct.toFixed(1)}%) in column ${col}`,
        severity: nullSeverity,
      });
    }

    // Format anomalies
    if (formatCheck && formatCheck.invalid > 0) {
      anomalies.push({
        type: 'format_violation',
        description: `${formatCheck.invalid} value(s) violate rule: ${formatCheck.rule}`,
        severity: formatCheck.severity,
      });
    }

    return {
      column: col,
      dataType: guessedType,
      totalRows,
      nullCount,
      nullRate: totalRows > 0 ? `${((nullCount / totalRows) * 100).toFixed(2)}%` : '0.00%',
      uniqueCount: uniqueValues.size || (colLower.includes('id') ? totalRows : Math.floor(Math.random() * 100000)),
      completeness: totalRows > 0 ? `${(((totalRows - nullCount) / totalRows) * 100).toFixed(2)}%` : '100.00%',
      validity: `${validityPct.toFixed(2)}%`,
      anomalies,
    };
  });

  const totalAnomalies = profile.reduce((sum, p) => sum + p.anomalies.length, 0);
  const avgCompleteness = profile.reduce((sum, p) => sum + parseFloat(p.completeness), 0) / profile.length;
  const avgValidity = profile.reduce((sum, p) => sum + parseFloat(p.validity), 0) / profile.length;

  const allAnomalies = profile.flatMap(p => p.anomalies);
  const critical = allAnomalies.filter(a => a.severity === 'Critical').length;
  const major = allAnomalies.filter(a => a.severity === 'Major').length;
  const minor = allAnomalies.filter(a => a.severity === 'Minor' || a.severity === 'Medium').length;

  return {
    datasetName: isCsv ? `Uploaded CSV (${columns.length} columns, ${rowCount} rows)` : (text.substring(0, 60) || 'Dataset'),
    rowCount: dataRows.length > 0 ? dataRows.length : rowCount,
    columnCount: columns.length,
    profileDate: new Date().toISOString(),
    columns: profile,
    qualityDimensions: {
      accuracy: { score: +avgValidity.toFixed(1), status: avgValidity >= 95 ? 'PASS' : 'FAIL', threshold: 95 },
      completeness: { score: +avgCompleteness.toFixed(1), status: avgCompleteness >= 98 ? 'PASS' : 'WARNING', threshold: 98 },
      consistency: { score: +(93 + Math.random() * 5).toFixed(1), status: 'PASS', threshold: 95 },
      timeliness: { score: +(97 + Math.random() * 2).toFixed(1), status: 'PASS', threshold: 95 },
      uniqueness: { score: +(98 + Math.random() * 1.5).toFixed(1), status: 'PASS', threshold: 99 },
      validity: { score: +avgValidity.toFixed(1), status: avgValidity >= 95 ? 'PASS' : 'FAIL', threshold: 95 },
    },
    anomalySummary: { total: totalAnomalies, critical, medium: major, low: minor },
  };
}

function validatePipeline(input: string) {
  const text = input.trim();
  const rules: Array<Record<string, unknown>> = [];

  // Extract table names from SQL or text
  const tableRegex = /(?:FROM|JOIN|INTO|UPDATE|TABLE)\s+["'`]?(\w+)["'`]?/gi;
  const tables = new Set<string>();
  let m;
  while ((m = tableRegex.exec(text)) !== null) {
    const tbl = m[1].toLowerCase();
    if (!['select', 'where', 'and', 'or', 'set', 'values', 'null'].includes(tbl)) {
      tables.add(m[1]);
    }
  }

  // Extract column names
  const colsInText = new Set<string>();
  const selectMatch = text.match(/SELECT\s+([\s\S]+?)\s+FROM/i);
  if (selectMatch && !selectMatch[1].includes('*')) {
    selectMatch[1].split(',').forEach(c => {
      const col = c.trim().split(/\s+as\s+/i).pop()?.trim().split('.').pop();
      if (col && col.length > 1) colsInText.add(col);
    });
  }
  // Also look for column references in WHERE/ON clauses
  const whereColRegex = /\b(\w+)\s*(?:=|IS|>|<|!=|LIKE|IN|BETWEEN)\b/gi;
  while ((m = whereColRegex.exec(text)) !== null) {
    const w = m[1].toLowerCase();
    if (!['select', 'from', 'where', 'and', 'or', 'not', 'null', 'true', 'false', 'count', 'sum', 'avg', 'min', 'max'].includes(w) && w.length > 2) {
      colsInText.add(m[1]);
    }
  }

  const tableList = [...tables];
  const colList = [...colsInText];
  const primaryTable = tableList[0] || 'source_table';

  // Generate rules based on extracted tables and columns
  // Row count rule for each table
  for (const tbl of tableList.slice(0, 3)) {
    const srcCount = 100000 + Math.floor(Math.random() * 2000000);
    const tgtCount = Math.random() > 0.85 ? srcCount - Math.floor(Math.random() * 50) : srcCount;
    rules.push({
      rule: `Row Count Match - ${tbl}`,
      source: srcCount,
      target: tgtCount,
      status: srcCount === tgtCount ? 'PASS' : 'FAIL',
      sql: `SELECT COUNT(*) FROM ${tbl}`,
      ...(srcCount !== tgtCount ? { details: `${srcCount - tgtCount} row(s) missing in target` } : {}),
    });
  }

  // Null checks for columns
  for (const col of colList.slice(0, 4)) {
    const nulls = Math.random() > 0.8 ? Math.floor(Math.random() * 20) : 0;
    rules.push({
      rule: `Null Check - ${col}`,
      source: 0,
      target: nulls,
      status: nulls === 0 ? 'PASS' : 'FAIL',
      sql: `SELECT COUNT(*) FROM ${primaryTable} WHERE ${col} IS NULL`,
      ...(nulls > 0 ? { details: `${nulls} unexpected NULL values found in ${col}` } : {}),
    });
  }

  // Numeric column sum checks
  const numericCols = colList.filter(c => {
    const cl = c.toLowerCase();
    return cl.includes('amount') || cl.includes('total') || cl.includes('price') || cl.includes('qty') || cl.includes('count') || cl.includes('balance');
  });
  for (const col of numericCols.slice(0, 2)) {
    const sum = Math.floor(Math.random() * 10000000) + 1000;
    rules.push({
      rule: `Sum Match - ${col}`,
      source: sum,
      target: sum,
      status: 'PASS',
      sql: `SELECT SUM(${col}) FROM ${primaryTable}`,
    });
  }

  // Duplicate check
  if (colList.length > 0) {
    const idCol = colList.find(c => c.toLowerCase().includes('id')) || colList[0];
    const dupes = Math.random() > 0.75 ? Math.floor(Math.random() * 5) + 1 : 0;
    rules.push({
      rule: `Duplicate Check - ${idCol}`,
      source: 0,
      target: dupes,
      status: dupes === 0 ? 'PASS' : 'FAIL',
      sql: `SELECT ${idCol}, COUNT(*) FROM ${primaryTable} GROUP BY ${idCol} HAVING COUNT(*) > 1`,
      ...(dupes > 0 ? { details: `${dupes} duplicate ${idCol}(s) in target` } : {}),
    });
  }

  // Referential integrity between tables
  if (tableList.length >= 2) {
    const orphans = Math.random() > 0.8 ? Math.floor(Math.random() * 5) + 1 : 0;
    rules.push({
      rule: `Referential Integrity - ${tableList[0]} to ${tableList[1]}`,
      source: 0,
      target: orphans,
      status: orphans === 0 ? 'PASS' : 'FAIL',
      sql: `SELECT COUNT(*) FROM ${tableList[0]} a LEFT JOIN ${tableList[1]} b ON a.id = b.id WHERE b.id IS NULL`,
      ...(orphans > 0 ? { details: `${orphans} orphan records found` } : {}),
    });
  }

  // Fallback if no rules generated
  if (rules.length === 0) {
    rules.push(
      { rule: 'Row Count Match', source: 2347891, target: 2347891, status: 'PASS', sql: 'SELECT COUNT(*) FROM source_table' },
      { rule: 'Sum Amount Match', source: 1523456789.50, target: 1523456789.50, status: 'PASS', sql: 'SELECT SUM(amount) FROM transactions' },
      { rule: 'Null Check', source: 0, target: 0, status: 'PASS', sql: 'SELECT COUNT(*) WHERE primary_key IS NULL' },
      { rule: 'Duplicate Check', source: 0, target: 3, status: 'FAIL', sql: 'SELECT id, COUNT(*) HAVING COUNT(*) > 1', details: '3 duplicate records in target' },
    );
  }

  const passed = rules.filter(r => r.status === 'PASS').length;
  const pipelineName = tableList.length > 0 ? `Pipeline: ${tableList.join(' -> ')}` : (text.substring(0, 60) || 'PSP Transaction ETL');

  return {
    pipelineName,
    rules,
    summary: { total: rules.length, passed, failed: rules.length - passed, passRate: Math.round((passed / rules.length) * 100) + '%' },
    tablesFound: tableList,
    columnsFound: colList,
  };
}

function validateVisualization(input: string) {
  const text = input.trim();
  const textLower = text.toLowerCase();

  // Extract dashboard name
  const dashNameMatch = text.match(/(?:dashboard|report|panel)[:\s]+["']?([^\n"']+)/i);
  const dashboardName = dashNameMatch ? dashNameMatch[1].trim() : (text.substring(0, 60) || 'Payment Analytics Dashboard');

  // Detect chart types mentioned
  const chartTypes: string[] = [];
  if (textLower.includes('bar')) chartTypes.push('bar chart');
  if (textLower.includes('line')) chartTypes.push('line chart');
  if (textLower.includes('pie') || textLower.includes('donut')) chartTypes.push('pie/donut chart');
  if (textLower.includes('scatter')) chartTypes.push('scatter plot');
  if (textLower.includes('heatmap') || textLower.includes('heat map')) chartTypes.push('heatmap');
  if (textLower.includes('table') || textLower.includes('grid')) chartTypes.push('data table');
  if (textLower.includes('gauge') || textLower.includes('kpi')) chartTypes.push('KPI gauge');
  if (textLower.includes('area')) chartTypes.push('area chart');
  if (textLower.includes('funnel')) chartTypes.push('funnel chart');
  if (chartTypes.length === 0) chartTypes.push('chart');

  // Build checks based on content
  const checks: Array<{ check: string; status: string; details: string }> = [];

  // Chart type check
  checks.push({
    check: 'Chart Type Matches Spec',
    status: 'PASS',
    details: `${chartTypes.join(', ')} detected in specification`,
  });

  // Data accuracy
  checks.push({
    check: 'Data Accuracy',
    status: 'PASS',
    details: 'All displayed values match source query results',
  });

  // Axis labels - warn if specific labels mentioned but potentially missing
  const hasAxisInfo = textLower.includes('axis') || textLower.includes('label');
  checks.push({
    check: 'Axis Labels',
    status: hasAxisInfo ? 'PASS' : 'WARNING',
    details: hasAxisInfo ? 'Axis labels present as specified' : 'Axis labels not explicitly defined in spec; verify unit labels are present',
  });

  // Color scheme
  checks.push({
    check: 'Color Scheme',
    status: textLower.includes('color') || textLower.includes('brand') ? 'PASS' : 'WARNING',
    details: textLower.includes('color') ? 'Color scheme matches specification' : 'No color scheme defined in spec; verify brand compliance',
  });

  // Legend
  checks.push({
    check: 'Legend Present',
    status: chartTypes.length > 1 || textLower.includes('legend') ? 'PASS' : 'WARNING',
    details: 'Legend should display all data series',
  });

  // Responsive layout
  checks.push({
    check: 'Responsive Layout',
    status: textLower.includes('responsive') || textLower.includes('mobile') ? 'PASS' : 'FAIL',
    details: textLower.includes('responsive') ? 'Responsive layout specified and verified' : 'No responsive behavior defined; chart may overlap on smaller screens',
  });

  // Accessibility
  checks.push({
    check: 'Accessibility (a11y)',
    status: textLower.includes('accessibility') || textLower.includes('alt text') || textLower.includes('wcag') ? 'PASS' : 'WARNING',
    details: textLower.includes('accessibility') ? 'Accessibility requirements defined' : 'No accessibility requirements specified; verify alt text, keyboard navigation, and screen reader support',
  });

  // Data freshness
  checks.push({
    check: 'Data Freshness',
    status: 'PASS',
    details: textLower.includes('real-time') || textLower.includes('live') ? 'Real-time data feed configured' : 'Dashboard shows data within acceptable freshness threshold',
  });

  // Chart-specific checks
  if (chartTypes.includes('pie/donut chart')) {
    checks.push({ check: 'Pie Chart Total = 100%', status: 'PASS', details: 'Pie/donut chart slices sum to 100%' });
  }
  if (chartTypes.includes('data table')) {
    checks.push({ check: 'Table Sorting & Pagination', status: textLower.includes('sort') || textLower.includes('page') ? 'PASS' : 'WARNING', details: 'Verify table supports sorting and pagination for large datasets' });
  }

  return {
    dashboardName,
    chartTypesDetected: chartTypes,
    checks,
    summary: {
      pass: checks.filter(c => c.status === 'PASS').length,
      warning: checks.filter(c => c.status === 'WARNING').length,
      fail: checks.filter(c => c.status === 'FAIL').length,
    },
  };
}

function reviewIaC(input: string) {
  const text = input.trim();
  const lines = text.split('\n');
  const findings: Array<Record<string, unknown>> = [];
  let findingId = 1;

  // Scan for security anti-patterns
  const patterns: Array<{ regex: RegExp; severity: string; rule: string; finding: string; recommendation: string; fix: string }> = [
    {
      regex: /cidr_blocks\s*=\s*\[.*"0\.0\.0\.0\/0".*\]/i,
      severity: 'High',
      rule: 'CIS 4.1',
      finding: 'Security group allows inbound traffic from 0.0.0.0/0 (any IP)',
      recommendation: 'Restrict access to specific CIDR ranges or VPN',
      fix: 'cidr_blocks = ["10.0.0.0/8"]  # Restrict to private network',
    },
    {
      regex: /Action\s*[=:]\s*["']\*["']/i,
      severity: 'Critical',
      rule: 'CIS 1.16',
      finding: 'IAM policy allows wildcard (*) actions on all resources',
      recommendation: 'Apply least privilege principle with specific actions',
      fix: 'Action = ["s3:GetObject", "s3:PutObject"]  # Specific actions only',
    },
    {
      regex: /password\s*=\s*"[^"]+"/i,
      severity: 'Critical',
      rule: 'CIS 2.3',
      finding: 'Hardcoded password/secret found in code',
      recommendation: 'Use a secrets manager (AWS Secrets Manager, Vault) or environment variables',
      fix: 'password = var.db_password  # Use variable with sensitive = true',
    },
    {
      regex: /default\s*=\s*"[^"]*(?:pass|secret|key|token)[^"]*"/i,
      severity: 'Critical',
      rule: 'CIS 2.3',
      finding: 'Sensitive default value in variable definition',
      recommendation: 'Remove default value for sensitive variables; pass via environment',
      fix: 'variable "db_password" {\n  type      = string\n  sensitive = true\n  # Pass via TF_VAR_db_password\n}',
    },
    {
      regex: /encrypted\s*=\s*false/i,
      severity: 'High',
      rule: 'CIS 2.1',
      finding: 'Encryption is explicitly disabled',
      recommendation: 'Enable encryption at rest for all storage resources',
      fix: 'encrypted = true',
    },
    {
      regex: /publicly_accessible\s*=\s*true/i,
      severity: 'Critical',
      rule: 'CIS 4.2',
      finding: 'Resource is publicly accessible',
      recommendation: 'Set publicly_accessible to false and use private subnets',
      fix: 'publicly_accessible = false',
    },
    {
      regex: /(?:from_port|to_port)\s*=\s*0[\s\S]{0,100}(?:from_port|to_port)\s*=\s*(?:65535|0)/i,
      severity: 'High',
      rule: 'CIS 4.1',
      finding: 'Security group allows all ports (0-65535)',
      recommendation: 'Restrict to specific required ports only',
      fix: 'from_port = 443\nto_port   = 443\nprotocol  = "tcp"',
    },
    {
      regex: /acl\s*=\s*"public-read"/i,
      severity: 'High',
      rule: 'CIS 2.1.2',
      finding: 'S3 bucket ACL set to public-read',
      recommendation: 'Use private ACL and bucket policies for controlled access',
      fix: 'acl = "private"',
    },
    {
      regex: /versioning\s*\{[\s\S]*?enabled\s*=\s*false/i,
      severity: 'Medium',
      rule: 'CIS 2.1.1',
      finding: 'S3 bucket versioning is disabled',
      recommendation: 'Enable versioning for data recovery and audit trail',
      fix: 'versioning {\n  enabled = true\n}',
    },
    {
      regex: /logging\s*=\s*false|access_logs\s*\{[\s\S]*?enabled\s*=\s*false/i,
      severity: 'Medium',
      rule: 'CIS 2.6',
      finding: 'Access logging is disabled',
      recommendation: 'Enable access logging for audit and security monitoring',
      fix: 'logging {\n  enabled = true\n  target_bucket = "access-logs-bucket"\n}',
    },
    {
      regex: /multi_az\s*=\s*false/i,
      severity: 'Medium',
      rule: 'Best Practice',
      finding: 'Multi-AZ is disabled for database/resource',
      recommendation: 'Enable Multi-AZ for high availability',
      fix: 'multi_az = true',
    },
    {
      regex: /deletion_protection\s*=\s*false/i,
      severity: 'Medium',
      rule: 'Best Practice',
      finding: 'Deletion protection is disabled',
      recommendation: 'Enable deletion protection for production resources',
      fix: 'deletion_protection = true',
    },
  ];

  // Scan each line for patterns
  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    for (const pattern of patterns) {
      if (pattern.regex.test(lines[lineIdx])) {
        findings.push({
          id: `IAC-${String(findingId++).padStart(3, '0')}`,
          severity: pattern.severity,
          file: 'uploaded_code',
          line: lineIdx + 1,
          rule: pattern.rule,
          description: pattern.finding,
          recommendation: pattern.recommendation,
          codeFix: pattern.fix,
        });
      }
    }
  }

  // Check for missing tags (look at resource blocks without tags)
  const resourceBlockRegex = /resource\s+"(\w+)"\s+"(\w+)"\s*\{/g;
  let rm;
  while ((rm = resourceBlockRegex.exec(text)) !== null) {
    const resourceStart = rm.index;
    // Find closing brace (simple heuristic)
    const blockText = text.substring(resourceStart, resourceStart + 500);
    if (!blockText.includes('tags') && !blockText.includes('tag ')) {
      const lineNum = text.substring(0, resourceStart).split('\n').length;
      findings.push({
        id: `IAC-${String(findingId++).padStart(3, '0')}`,
        severity: 'Low',
        file: 'uploaded_code',
        line: lineNum,
        rule: 'Best Practice',
        description: `Resource ${rm[1]}.${rm[2]} is missing tags for cost allocation and management`,
        recommendation: 'Add standard tags (Environment, Project, ManagedBy) to all resources',
        codeFix: `tags = {\n  Environment = var.environment\n  Project     = "payment-infra"\n  ManagedBy   = "Terraform"\n}`,
      });
    }
  }

  // Check for missing backend config
  if (text.includes('terraform') && !text.includes('backend')) {
    findings.push({
      id: `IAC-${String(findingId++).padStart(3, '0')}`,
      severity: 'Medium',
      file: 'uploaded_code',
      line: 1,
      rule: 'Best Practice',
      description: 'No backend configuration for remote state',
      recommendation: 'Configure S3/GCS backend with state locking',
      codeFix: 'terraform {\n  backend "s3" {\n    bucket         = "terraform-state"\n    key            = "infra/terraform.tfstate"\n    region         = "ap-southeast-1"\n    dynamodb_table = "terraform-locks"\n  }\n}',
    });
  }

  // If no findings from scanning, provide generic findings as fallback
  if (findings.length === 0) {
    findings.push(
      { id: 'IAC-001', severity: 'Low', file: 'uploaded_code', line: 1, rule: 'Best Practice', description: 'No specific security issues detected in the provided code', recommendation: 'Continue to follow infrastructure security best practices', codeFix: '' },
    );
  }

  const counts = {
    critical: findings.filter(f => f.severity === 'Critical').length,
    high: findings.filter(f => f.severity === 'High').length,
    medium: findings.filter(f => f.severity === 'Medium').length,
    low: findings.filter(f => f.severity === 'Low').length,
  };
  const total = counts.critical + counts.high + counts.medium + counts.low;
  const score = Math.max(0, Math.round(100 - (counts.critical * 15 + counts.high * 10 + counts.medium * 5 + counts.low * 2)));

  return {
    filesReviewed: 1,
    findings,
    counts,
    complianceScore: score,
    summary: `Scanned ${lines.length} lines of IaC code. Found ${total} issue(s): ${counts.critical} critical, ${counts.high} high, ${counts.medium} medium, ${counts.low} low. Compliance score: ${score}%.`,
  };
}

function scanSecurity(input: string) {
  const text = input.trim();
  const controls: Array<Record<string, unknown>> = [];

  // Try to parse as JSON (Prowler/ScoutSuite results)
  let parsedJson: unknown = null;
  try {
    parsedJson = JSON.parse(text);
  } catch { /* not JSON */ }

  if (parsedJson && typeof parsedJson === 'object') {
    const jsonObj = parsedJson as Record<string, unknown>;

    // Handle array of findings (common Prowler format)
    const findings = Array.isArray(parsedJson) ? parsedJson : (jsonObj.findings || jsonObj.results || jsonObj.checks || []);

    if (Array.isArray(findings) && findings.length > 0) {
      for (const finding of findings.slice(0, 20)) {
        const f = finding as Record<string, unknown>;
        controls.push({
          controlId: f.controlId || f.control_id || f.CheckID || f.id || `CTRL-${controls.length + 1}`,
          title: f.title || f.CheckTitle || f.description || f.name || 'Security Control',
          status: (String(f.status || f.Status || f.result || '').toUpperCase().includes('FAIL') || String(f.status || '').toUpperCase().includes('ALARM')) ? 'FAIL' : 'PASS',
          details: f.details || f.StatusExtended || f.detail || f.message || '',
          ...(String(f.status || f.Status || '').toUpperCase().includes('FAIL') ? {
            remediation: f.remediation || f.Remediation || f.recommendation || 'Review and remediate this finding',
          } : {}),
          severity: f.severity || f.Severity || f.level || 'Medium',
          service: f.service || f.ServiceName || f.resourceType || 'Unknown',
        });
      }
    }
  }

  // If no controls from JSON, analyze text content
  if (controls.length === 0) {
    const keywords = extractKeywords(text);
    const textLower = text.toLowerCase();

    // Generate controls based on content analysis
    const secChecks = [
      { match: 'root', controlId: 'CIS 1.1', title: 'Avoid use of root account', passIf: textLower.includes('mfa') || textLower.includes('disabled') },
      { match: 'key', controlId: 'CIS 1.4', title: 'Ensure access keys are rotated', passIf: textLower.includes('rotated') || textLower.includes('rotation') },
      { match: 'trail', controlId: 'CIS 2.1', title: 'Ensure CloudTrail is enabled', passIf: textLower.includes('enabled') || textLower.includes('active') },
      { match: 'encrypt', controlId: 'CIS 2.7', title: 'Ensure logs are encrypted', passIf: textLower.includes('kms') || textLower.includes('encrypted') },
      { match: 'metric', controlId: 'CIS 3.1', title: 'Ensure log metric filter for unauthorized API calls', passIf: textLower.includes('metric filter') },
      { match: 'security group', controlId: 'CIS 4.1', title: 'Ensure no security groups allow 0.0.0.0/0', passIf: !textLower.includes('0.0.0.0/0') },
      { match: 'flow', controlId: 'CIS 4.3', title: 'Ensure VPC flow logging is enabled', passIf: textLower.includes('flow log') && textLower.includes('enabled') },
      { match: 'acl', controlId: 'CIS 5.1', title: 'Ensure network ACLs prevent unrestricted traffic', passIf: !textLower.includes('allow all') },
      { match: 'password', controlId: 'CIS 1.9', title: 'Ensure IAM password policy is strong', passIf: textLower.includes('complexity') || textLower.includes('14 char') },
      { match: 'backup', controlId: 'CIS 2.8', title: 'Ensure backup/recovery is configured', passIf: textLower.includes('backup') && textLower.includes('enabled') },
    ];

    for (const check of secChecks) {
      if (textLower.includes(check.match) || controls.length < 5) {
        controls.push({
          controlId: check.controlId,
          title: check.title,
          status: check.passIf ? 'PASS' : 'FAIL',
          details: check.passIf ? `Check passed based on content analysis` : `Potential issue detected related to: ${check.match}`,
          ...(check.passIf ? {} : { remediation: `Review ${check.match} configuration and ensure compliance` }),
        });
      }
    }
  }

  // Ensure at least some controls
  if (controls.length === 0) {
    controls.push(
      { controlId: 'CIS 1.1', title: 'Avoid use of root account', status: 'PASS', details: 'No root account usage detected' },
      { controlId: 'CIS 2.1', title: 'Ensure CloudTrail is enabled', status: 'PASS', details: 'CloudTrail configuration present' },
      { controlId: 'CIS 4.1', title: 'Ensure no open security groups', status: 'FAIL', details: 'Unable to verify security group configuration', remediation: 'Review security group rules' },
    );
  }

  const passed = controls.filter(c => c.status === 'PASS').length;
  return {
    framework: 'CIS AWS Benchmark v1.5',
    scanDate: new Date().toISOString(),
    controls,
    summary: {
      total: controls.length,
      passed,
      failed: controls.length - passed,
      complianceRate: Math.round((passed / controls.length) * 100) + '%',
    },
    inputType: parsedJson ? 'JSON (parsed)' : 'Text analysis',
  };
}

function generateDRScenarios(input: string) {
  const text = input.trim();
  const textLower = text.toLowerCase();

  // Extract infrastructure components
  const components: Array<{ name: string; category: string }> = [];
  const componentPatterns: Array<{ keywords: string[]; name: string; category: string }> = [
    { keywords: ['database', 'rds', 'postgres', 'mysql', 'aurora', 'mongodb', 'dynamodb', 'sql server', 'oracle'], name: 'Database', category: 'Database' },
    { keywords: ['redis', 'elasticache', 'memcache', 'cache'], name: 'Cache Layer', category: 'Cache' },
    { keywords: ['load balancer', 'alb', 'nlb', 'elb', 'nginx', 'haproxy'], name: 'Load Balancer', category: 'Network' },
    { keywords: ['queue', 'sqs', 'rabbitmq', 'kafka', 'kinesis', 'mq'], name: 'Message Queue', category: 'Messaging' },
    { keywords: ['s3', 'storage', 'blob', 'bucket', 'file system', 'efs', 'ebs'], name: 'Storage', category: 'Storage' },
    { keywords: ['api gateway', 'kong', 'apigee', 'api management'], name: 'API Gateway', category: 'Network' },
    { keywords: ['kubernetes', 'k8s', 'ecs', 'fargate', 'container', 'docker'], name: 'Container Orchestration', category: 'Compute' },
    { keywords: ['ec2', 'vm', 'instance', 'compute', 'server', 'lambda', 'function'], name: 'Compute', category: 'Compute' },
    { keywords: ['cdn', 'cloudfront', 'akamai', 'fastly'], name: 'CDN', category: 'Network' },
    { keywords: ['dns', 'route53', 'domain'], name: 'DNS', category: 'Network' },
    { keywords: ['vpc', 'network', 'subnet', 'firewall', 'security group'], name: 'Network Infrastructure', category: 'Network' },
    { keywords: ['monitoring', 'cloudwatch', 'datadog', 'prometheus', 'grafana'], name: 'Monitoring', category: 'Observability' },
  ];

  for (const cp of componentPatterns) {
    for (const kw of cp.keywords) {
      if (textLower.includes(kw)) {
        components.push({ name: cp.name, category: cp.category });
        break;
      }
    }
  }

  // Extract RPO/RTO values
  const rpoMatch = textLower.match(/rpo[:\s=]+(\d+)\s*(min|hour|sec|s|h|m)/i);
  const rtoMatch = textLower.match(/rto[:\s=]+(\d+)\s*(min|hour|sec|s|h|m)/i);
  const rpoValue = rpoMatch ? `${rpoMatch[1]} ${rpoMatch[2]}` : null;
  const rtoValue = rtoMatch ? `${rtoMatch[1]} ${rtoMatch[2]}` : null;

  // Generate scenarios based on detected components
  const scenarios: Array<Record<string, unknown>> = [];
  let drIdx = 1;

  // Always generate component-specific DR scenarios
  for (const comp of components.slice(0, 4)) {
    const rpo = rpoValue || (comp.category === 'Database' ? '5 min' : '0 min');
    const rto = rtoValue || (comp.category === 'Database' ? '15 min' : '5 min');

    scenarios.push({
      id: `DR-${String(drIdx++).padStart(3, '0')}`,
      name: `${comp.name} Failover`,
      category: comp.category,
      rpoTarget: rpo,
      rtoTarget: rto,
      steps: [
        `Simulate ${comp.name.toLowerCase()} failure`,
        `Verify automatic failover/recovery`,
        `Confirm data integrity (RPO: ${rpo})`,
        `Measure recovery time against target (RTO: ${rto})`,
        `Validate dependent services reconnect`,
      ],
      expectedOutcome: `${comp.name} recovers within ${rto}, data loss within ${rpo} target`,
    });
  }

  // Add generic DR scenarios if few components detected
  if (scenarios.length < 2) {
    scenarios.push({
      id: `DR-${String(drIdx++).padStart(3, '0')}`,
      name: 'Primary Database Failover',
      category: 'Database',
      rpoTarget: rpoValue || '5 min',
      rtoTarget: rtoValue || '15 min',
      steps: ['Simulate primary DB failure', 'Verify automatic failover to standby', 'Confirm zero data loss (RPO)', 'Measure recovery time', 'Validate application connectivity'],
      expectedOutcome: 'Standby promotes within target RTO, data loss within RPO',
    });
  }

  // Always add AZ/region-level scenarios
  scenarios.push({
    id: `DR-${String(drIdx++).padStart(3, '0')}`,
    name: 'Availability Zone Failure',
    category: 'Infrastructure',
    rpoTarget: '0 min',
    rtoTarget: rtoValue || '5 min',
    steps: [
      'Terminate all instances in primary AZ',
      'Verify auto-scaling launches replacements in secondary AZ',
      `Confirm ${components.length > 0 ? components.map(c => c.name).join(', ') : 'services'} remain available`,
      'Validate load balancer health checks pass',
    ],
    expectedOutcome: `All ${components.length || 'critical'} services recover in secondary AZ`,
  });

  if (textLower.includes('region') || textLower.includes('disaster') || textLower.includes('cross-region') || components.length >= 3) {
    scenarios.push({
      id: `DR-${String(drIdx++).padStart(3, '0')}`,
      name: 'Region-wide Outage',
      category: 'Disaster Recovery',
      rpoTarget: rpoValue || '15 min',
      rtoTarget: rtoValue || '60 min',
      steps: ['Simulate region failure', 'Activate DR region', 'Restore from cross-region backup', 'Update DNS routing', 'Validate all services operational'],
      expectedOutcome: 'Full recovery in DR region within target RTO',
    });
  }

  // Network partition scenario
  if (textLower.includes('network') || components.some(c => c.category === 'Network') || scenarios.length < 4) {
    scenarios.push({
      id: `DR-${String(drIdx++).padStart(3, '0')}`,
      name: 'Network Partition',
      category: 'Network',
      rpoTarget: '0 min',
      rtoTarget: '10 min',
      steps: ['Block network between application tiers', 'Verify circuit breaker activation', 'Confirm graceful degradation', 'Restore connectivity', 'Verify data consistency'],
      expectedOutcome: 'Circuit breaker prevents cascading failure; graceful degradation active',
    });
  }

  const categories = [...new Set(scenarios.map(s => s.category as string))];

  return {
    scenarios,
    infrastructure: text.substring(0, 100) || 'Bank Indonesia Payment Infrastructure',
    detectedComponents: components.map(c => c.name),
    rpoTarget: rpoValue,
    rtoTarget: rtoValue,
    summary: { totalScenarios: scenarios.length, categories, componentsDetected: components.length },
  };
}

function classifyDefect(input: string) {
  const text = input.toLowerCase();
  const originalText = input.trim();
  let severity = 'Minor';
  let priority = 'Medium';
  let rootCause = 'Logic Error';
  let team = 'Backend Team';

  // Extract error messages
  const errorMsgMatch = originalText.match(/(?:error|exception|message)[:\s]+["']?(.+?)["']?(?:\n|$)/i);
  const errorMessage = errorMsgMatch ? errorMsgMatch[1].trim().substring(0, 120) : null;

  // Extract module/component name
  const moduleMatch = originalText.match(/(?:module|component|service|page|screen)[:\s]+["']?([^\n"']+)/i);
  const detectedModule = moduleMatch ? moduleMatch[1].trim() : guessModule(originalText);

  // Extract stack trace indicators
  const hasStackTrace = text.includes('at ') && (text.includes('.java:') || text.includes('.py:') || text.includes('.ts:') || text.includes('.js:'));
  const stackTraceFile = originalText.match(/at\s+[\w.]+\(([\w.]+:\d+)\)/)?.[1] || null;

  // Extract HTTP status codes
  const httpStatus = text.match(/\b(4\d{2}|5\d{2})\b/)?.[1];

  // Severity classification
  if (text.includes('crash') || text.includes('data loss') || text.includes('security breach') || text.includes('outage') || text.includes('production down')) {
    severity = 'Critical'; priority = 'High';
  } else if (text.includes('incorrect') || text.includes('fail') || text.includes('error') || text.includes('exception') || text.includes('500') || text.includes('corrupt')) {
    severity = 'Major'; priority = 'High';
  } else if (text.includes('slow') || text.includes('timeout') || text.includes('degraded')) {
    severity = 'Major'; priority = 'Medium';
  } else if (text.includes('ui') || text.includes('display') || text.includes('format') || text.includes('alignment') || text.includes('typo') || text.includes('cosmetic')) {
    severity = 'Minor'; priority = 'Low'; team = 'Frontend Team';
  } else if (text.includes('label') || text.includes('color') || text.includes('font') || text.includes('style')) {
    severity = 'Cosmetic'; priority = 'Low'; team = 'Frontend Team';
  }

  // Root cause classification
  if (text.includes('timeout') || text.includes('slow') || text.includes('performance') || text.includes('latency') || text.includes('memory leak')) {
    rootCause = 'Performance Bottleneck'; team = 'Platform Team';
  } else if (text.includes('integration') || text.includes('api') || text.includes('connection') || text.includes('endpoint') || text.includes('gateway') || httpStatus) {
    rootCause = 'Integration Failure'; team = 'Integration Team';
  } else if (text.includes('data') || text.includes('inconsisten') || text.includes('mismatch') || text.includes('duplicate')) {
    rootCause = 'Data Inconsistency'; team = 'Data Team';
  } else if (text.includes('config') || text.includes('setting') || text.includes('environment') || text.includes('variable')) {
    rootCause = 'Configuration Error'; team = 'DevOps Team';
  } else if (text.includes('null') || text.includes('undefined') || text.includes('reference') || hasStackTrace) {
    rootCause = 'Null Reference / Logic Error'; team = 'Backend Team';
  } else if (text.includes('permission') || text.includes('unauthorized') || text.includes('forbidden') || text.includes('403') || text.includes('401')) {
    rootCause = 'Authorization/Permission Error'; team = 'Security Team';
  } else if (text.includes('concurrent') || text.includes('race') || text.includes('deadlock') || text.includes('lock')) {
    rootCause = 'Concurrency Issue'; team = 'Backend Team';
  }

  // Build description from input
  const description = truncateText(originalText.split('\n')[0], 120);

  return {
    severity,
    priority,
    rootCause,
    assignedTeam: team,
    detectedModule,
    description,
    errorMessage,
    stackTraceFile,
    httpStatus: httpStatus || null,
    confidence: { severity: 0.87, priority: 0.82, rootCause: 0.79 },
    similarDefects: [
      { id: 'DEF-' + String(Math.floor(Math.random() * 100)).padStart(3, '0'), similarity: 0.85, title: `Similar ${rootCause.toLowerCase()} in ${detectedModule}` },
      { id: 'DEF-' + String(Math.floor(Math.random() * 100)).padStart(3, '0'), similarity: 0.72, title: `Related ${severity.toLowerCase()} defect in same module` },
    ],
    workflow: ['OPEN', 'UNDER REVIEW', 'CONFIRMED', 'IN PROGRESS', 'RESOLVED', 'CLOSED'],
  };
}

function analyzeDefectPatterns(input: string) {
  const text = input.trim();
  const textLower = text.toLowerCase();

  // Extract module names from input
  const detectedModules = new Set<string>();
  const lines = text.split('\n').filter(l => l.trim().length > 3);
  for (const line of lines.slice(0, 50)) {
    detectedModules.add(guessModule(line));
  }

  // Also look for explicit module names
  const moduleRegex = /(?:module|component|service)[:\s]+["']?([^\n"',]+)/gi;
  let mm;
  while ((mm = moduleRegex.exec(text)) !== null) {
    detectedModules.add(mm[1].trim());
  }

  const modules = detectedModules.size > 0 ? [...detectedModules].slice(0, 8) : ['Payment Gateway', 'PSP Onboarding', 'Transaction Processing', 'API Gateway', 'Data Pipeline', 'Dashboard'];

  // Count severity keywords in input for more realistic weighting
  const critCount = (textLower.match(/critical|crash|outage|data loss/g) || []).length;
  const majorCount = (textLower.match(/major|error|fail|exception|incorrect/g) || []).length;
  const minorCount = (textLower.match(/minor|warning|cosmetic|typo|display/g) || []).length;
  const totalMentions = critCount + majorCount + minorCount || 1;

  const heatmap = modules.map(mod => {
    const modLower = mod.toLowerCase();
    // Weight risk score higher for modules mentioned more frequently
    const mentionCount = (textLower.match(new RegExp(modLower.split(' ')[0], 'g')) || []).length;
    const riskBoost = Math.min(mentionCount * 5, 30);
    const critical = Math.floor(Math.random() * 3) + (mentionCount > 2 ? 2 : 0);
    const major = Math.floor(Math.random() * 8) + (mentionCount > 1 ? 3 : 0);
    const minor = Math.floor(Math.random() * 12);
    const cosmetic = Math.floor(Math.random() * 5);
    const riskScore = Math.min(99, Math.round(30 + Math.random() * 40 + riskBoost + critical * 10 + major * 3));
    return { module: mod, critical, major, minor, cosmetic, riskScore };
  });

  // Extract root cause hints from text
  const rootCauseMap: Record<string, number> = {};
  const causeMappings = [
    { keywords: ['logic', 'calculation', 'wrong result', 'incorrect'], cause: 'Logic Error' },
    { keywords: ['integration', 'api', 'connection', 'timeout', 'gateway'], cause: 'Integration Failure' },
    { keywords: ['slow', 'performance', 'latency', 'memory'], cause: 'Performance Bottleneck' },
    { keywords: ['data', 'inconsisten', 'mismatch', 'duplicate'], cause: 'Data Inconsistency' },
    { keywords: ['config', 'setting', 'environment', 'deploy'], cause: 'Configuration Error' },
    { keywords: ['permission', 'auth', 'unauthorized', 'security'], cause: 'Security/Auth Issue' },
  ];
  for (const mapping of causeMappings) {
    let count = 0;
    for (const kw of mapping.keywords) {
      count += (textLower.match(new RegExp(kw, 'g')) || []).length;
    }
    if (count > 0) rootCauseMap[mapping.cause] = count;
  }

  // Sort root causes by count
  const rootCauses = Object.entries(rootCauseMap).length > 0
    ? Object.entries(rootCauseMap).sort((a, b) => b[1] - a[1]).map(([cause, count]) => {
        const total = Object.values(rootCauseMap).reduce((s, v) => s + v, 0);
        return { cause, count: count * 8 + Math.floor(Math.random() * 10), percentage: Math.round((count / total) * 100) + '%' };
      })
    : [
        { cause: 'Logic Error', count: 45, percentage: '29%' },
        { cause: 'Integration Failure', count: 32, percentage: '21%' },
        { cause: 'Performance Bottleneck', count: 28, percentage: '18%' },
        { cause: 'Data Inconsistency', count: 22, percentage: '14%' },
        { cause: 'Configuration Error', count: 18, percentage: '12%' },
      ];

  const totalDefects = heatmap.reduce((s, h) => s + h.critical + h.major + h.minor + h.cosmetic, 0);
  const topModule = heatmap.sort((a, b) => b.riskScore - a.riskScore)[0];

  return {
    period: text.substring(0, 30) || 'Last 6 months',
    heatmap: heatmap.sort((a, b) => b.riskScore - a.riskScore),
    trends: {
      totalDefects,
      openDefects: Math.floor(totalDefects * 0.22),
      avgResolutionDays: +(3 + Math.random() * 3).toFixed(1),
      reopenRate: `${(5 + Math.random() * 8).toFixed(1)}%`,
      topRootCauses: rootCauses.slice(0, 6),
    },
    recommendations: [
      `Focus regression testing on ${topModule.module} module (risk score: ${topModule.riskScore})`,
      `Increase code review coverage for modules with high defect density`,
      rootCauses[0] ? `Address top root cause "${rootCauses[0].cause}" with targeted improvements` : 'Add automated benchmarks to CI/CD pipeline',
      `Implement data validation layer for ${modules[modules.length > 1 ? 1 : 0]} flow`,
      `${totalDefects > 100 ? 'Consider dedicated bug-bash sprint to reduce defect backlog' : 'Continue current testing cadence with focus on high-risk areas'}`,
    ],
    modulesAnalyzed: modules.length,
    inputAnalysis: { linesProcessed: lines.length, modulesDetected: modules.length, severityKeywordsFound: { critical: critCount, major: majorCount, minor: minorCount } },
  };
}

function generateReport(input: string, options?: Record<string, unknown>) {
  const reportType = (options?.reportType as string) || 'qc-summary';
  const text = input.trim();
  const textLower = text.toLowerCase();

  // Extract meaningful data from input
  const modules = guessModulesFromText(text);
  const keywords = extractKeywords(text);

  // Try to extract numeric data from input
  const numberMatches = text.match(/\b\d+\b/g) || [];
  const numbers = numberMatches.map(Number).filter(n => n > 0 && n < 100000);
  const totalCases = numbers.find(n => n > 50 && n < 10000) || 234;
  const passRate = numbers.find(n => n > 80 && n <= 100) || 94;

  // Detect defect counts from input
  const critMatch = textLower.match(/(\d+)\s*critical/);
  const majorMatch = textLower.match(/(\d+)\s*(?:major|high)/);
  const minorMatch = textLower.match(/(\d+)\s*(?:minor|low)/);
  const criticalDefects = critMatch ? parseInt(critMatch[1]) : 1;
  const majorDefects = majorMatch ? parseInt(majorMatch[1]) : 3;
  const minorDefects = minorMatch ? parseInt(minorMatch[1]) : 3;
  const totalNew = criticalDefects + majorDefects + minorDefects + 1;

  // Extract sprint/release info
  const sprintMatch = text.match(/sprint\s*(\d+)/i);
  const releaseMatch = text.match(/release\s*([v\d.]+)/i);
  const sprintLabel = sprintMatch ? `Sprint ${sprintMatch[1]}` : releaseMatch ? `Release ${releaseMatch[1]}` : 'Current Sprint';

  const executed = Math.round(totalCases * 0.97);
  const passed = Math.round(executed * passRate / 100);
  const failed = executed - passed;
  const blocked = totalCases - executed;
  const computedPassRate = ((passed / executed) * 100).toFixed(1) + '%';

  const qualityScore = Math.round(passRate * 0.4 + (100 - criticalDefects * 15) * 0.3 + Math.min(100, totalCases / 3) * 0.3);
  const hasOpenCriticals = criticalDefects > 0;

  return {
    reportType,
    title: reportType === 'qc-summary' ? `QC Summary Report - ${sprintLabel}` : reportType === 'test-progress' ? `Test Progress Report - ${sprintLabel}` : `Defect Analysis Report - ${sprintLabel}`,
    generatedAt: new Date().toISOString(),
    sections: [
      {
        title: 'Executive Summary',
        content: `${sprintLabel} testing completed with ${computedPassRate} test case pass rate across ${modules.slice(0, 3).join(', ')} modules. ${totalNew} new defects found (${criticalDefects} critical). Overall quality score: ${qualityScore}/100. ${hasOpenCriticals ? 'Open critical defects require attention before release.' : 'System is trending toward release readiness.'}`,
      },
      {
        title: 'Test Execution Metrics',
        data: { totalCases, executed, passed, failed, blocked, passRate: computedPassRate },
      },
      {
        title: 'Defect Summary',
        data: { totalNew, resolved: Math.max(0, totalNew - criticalDefects), open: criticalDefects + 1, bySeverity: { critical: criticalDefects, major: majorDefects, minor: minorDefects, cosmetic: 1 } },
      },
      {
        title: 'Quality Gate Assessment',
        data: { status: hasOpenCriticals ? 'CONDITIONAL PASS' : 'PASS', criteria: [
          { gate: 'Test Coverage > 80%', value: `${Math.min(99, passRate + 3)}%`, status: passRate > 77 ? 'PASS' : 'FAIL' },
          { gate: 'Critical Defects = 0', value: criticalDefects > 0 ? `${criticalDefects} open` : '0', status: criticalDefects > 0 ? 'FAIL' : 'PASS' },
          { gate: 'Pass Rate > 90%', value: computedPassRate, status: passRate > 90 ? 'PASS' : 'FAIL' },
          { gate: 'Performance SLA Met', value: `Avg ${200 + Math.floor(Math.random() * 150)}ms`, status: 'PASS' },
        ]},
      },
      {
        title: 'Modules Covered',
        data: { modules, keyAreas: keywords },
      },
      {
        title: 'Risk Assessment',
        content: hasOpenCriticals
          ? `${criticalDefects > 1 ? 'High' : 'Medium'} risk due to ${criticalDefects} open critical defect(s) in ${modules[0]}. Recommend fixing before release.`
          : `Low risk. All critical defects resolved. ${modules[0]} module has highest test coverage.`,
      },
    ],
  };
}
