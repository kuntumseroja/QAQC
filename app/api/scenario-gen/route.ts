import { NextResponse } from 'next/server';
import { processAI, buildConfigForProvider, type LLMProvider } from '@/lib/ai-engine';
import { eventBus, TOPICS } from '@/lib/event-bus';

// Allow long-running multi-pass generation (Railway proxy is generous on Node runtime).
export const runtime = 'nodejs';
export const maxDuration = 300; // seconds

// Limit how many module calls run in parallel — protects Railway container
// from CPU/memory spikes and prevents upstream API rate-limit cascades.
const MAX_PARALLEL_MODULES = 3;
// Cap total modules per request so a runaway plan doesn't spawn 50 calls.
const MAX_MODULES_PER_REQUEST = 12;
// Per-call timeout (ms) — if a single module hangs we abandon it instead of
// letting the whole request time out at the proxy.
const PER_MODULE_TIMEOUT_MS = 90_000;

async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return await Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)),
  ]);
}

// Run an array of async tasks with a concurrency limit.
async function runWithConcurrency<T, R>(items: T[], limit: number, worker: (item: T, idx: number) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let cursor = 0;
  async function next() {
    while (cursor < items.length) {
      const idx = cursor++;
      try {
        results[idx] = { status: 'fulfilled', value: await worker(items[idx], idx) };
      } catch (e) {
        results[idx] = { status: 'rejected', reason: e };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => next()));
  return results;
}

interface Scenario {
  scenarioId?: string;
  module?: string;
  functionalRequirement?: string;
  testType?: string;
  priority?: string;
  precondition?: string;
  steps?: string[];
  expectedResult?: string;
  mappedRequirement?: string;
  [k: string]: unknown;
}

interface ScenarioResult {
  scenarios?: Scenario[];
  summary?: { total?: number; positive?: number; negative?: number; edge?: number };
  [k: string]: unknown;
}

// Multi-pass strategy:
// Pass 1 — planning: ask the LLM to enumerate the modules / domains / chapters in the doc.
// Pass 2 — per-module generation in parallel (each call has its own token budget).
// Final — merge all scenarios, renumber IDs, recompute summary.
async function runMultiPass(
  inputContent: string,
  documentName: string,
  llmConfig: ReturnType<typeof buildConfigForProvider> | undefined,
  options: Record<string, unknown> | undefined,
): Promise<{ result: ScenarioResult; meta: { provider: string; model: string; processingTime: number; confidence: number; tokens: { input: number; output: number }; inputLength: number; passes: number } }> {
  const startTime = Date.now();

  // ---- Pass 1: planning ----
  const planResp = await processAI({
    service: 'scenario-gen',
    prompt: `PLANNING PASS ONLY — do NOT generate test scenarios yet.

Document name: ${documentName}
Content length: ${inputContent.length} characters

Read the FSD/BRD/SRS below and produce a JSON list of the distinct modules / domains / functional areas that need test coverage. Be exhaustive — include every chapter, screen, workflow, master data area, integration, and reporting feature.

Respond with ONLY this JSON shape (no scenarios):
{
  "modules": [
    { "name": "Registrasi CIF Individu", "chapter": "1.2", "summary": "1-2 line description", "expectedScenarios": 8 },
    { "name": "Penjaminan Cash Loan", "chapter": "9.3.1", "summary": "...", "expectedScenarios": 12 }
  ]
}

Aim for 8–25 modules. Each "expectedScenarios" should reflect realistic coverage (positive + negative + edge cases) for that module.`,
    input: inputContent,
    options,
    llmConfig,
  });

  const planResult = planResp.result as { modules?: Array<{ name: string; chapter?: string; summary?: string; expectedScenarios?: number }> };
  let modules = Array.isArray(planResult?.modules) ? planResult.modules : [];
  if (modules.length > MAX_MODULES_PER_REQUEST) {
    console.log(`[scenario-gen] plan returned ${modules.length} modules, capping at ${MAX_MODULES_PER_REQUEST}`);
    modules = modules.slice(0, MAX_MODULES_PER_REQUEST);
  }

  if (modules.length === 0) {
    // Planning failed — fall back to a single-pass call
    const single = await processAI({
      service: 'scenario-gen',
      prompt: `Generate comprehensive test scenarios from the FSD/BRD/SRS document below. Cover EVERY module, screen, workflow, and integration.\n\nDocument: ${documentName}`,
      input: inputContent,
      options,
      llmConfig,
    });
    const r = single.result as ScenarioResult;
    return {
      result: r,
      meta: {
        provider: single.provider,
        model: single.model,
        processingTime: Date.now() - startTime,
        confidence: single.confidence,
        tokens: single.tokens,
        inputLength: inputContent.length,
        passes: 1,
      },
    };
  }

  // ---- Pass 2: per-module generation, throttled to MAX_PARALLEL_MODULES ----
  const perModuleResults = await runWithConcurrency(modules, MAX_PARALLEL_MODULES, async (mod) => {
    const moduleScenarioCount = Math.max(5, Math.min(20, mod.expectedScenarios || 10));
    return withTimeout(
      processAI({
        service: 'scenario-gen',
        prompt: `Generate ${moduleScenarioCount}+ test scenarios FOR THIS SPECIFIC MODULE ONLY:

Module: "${mod.name}"${mod.chapter ? ` (Chapter ${mod.chapter})` : ''}
Module summary: ${mod.summary || 'see document'}

Document: ${documentName}

Cover positive, negative, and edge cases. Reference actual fields, validations, workflows, and integrations described for this module in the document below. Do NOT generate scenarios for OTHER modules — focus only on "${mod.name}".

Set the "module" field of every scenario to exactly: "${mod.name}".`,
        input: inputContent,
        options,
        llmConfig,
      }),
      PER_MODULE_TIMEOUT_MS,
      `module "${mod.name}"`,
    );
  });

  // ---- Merge ----
  const allScenarios: Scenario[] = [];
  let totalInputTokens = planResp.tokens.input;
  let totalOutputTokens = planResp.tokens.output;
  let providerOut = planResp.provider as string;
  let modelOut = planResp.model;

  for (const settled of perModuleResults) {
    if (settled.status === 'fulfilled') {
      const r = settled.value.result as ScenarioResult;
      const scs = Array.isArray(r?.scenarios) ? r.scenarios : [];
      allScenarios.push(...scs);
      totalInputTokens += settled.value.tokens.input;
      totalOutputTokens += settled.value.tokens.output;
      providerOut = settled.value.provider as string;
      modelOut = settled.value.model;
    } else {
      console.warn('[scenario-gen multi-pass] module call failed:', settled.reason);
    }
  }

  // Renumber scenario IDs sequentially across all modules
  allScenarios.forEach((s, i) => {
    s.scenarioId = `TC-${String(i + 1).padStart(3, '0')}`;
  });

  const summary = {
    total: allScenarios.length,
    positive: allScenarios.filter(s => String(s.testType || '').toLowerCase().includes('positive')).length,
    negative: allScenarios.filter(s => String(s.testType || '').toLowerCase().includes('negative')).length,
    edge: allScenarios.filter(s => /edge|boundary/i.test(String(s.testType || ''))).length,
  };

  return {
    result: { scenarios: allScenarios, summary, _planModules: modules } as ScenarioResult,
    meta: {
      provider: providerOut,
      model: modelOut,
      processingTime: Date.now() - startTime,
      confidence: 0.85,
      tokens: { input: totalInputTokens, output: totalOutputTokens },
      inputLength: inputContent.length,
      passes: 1 + modules.length,
    },
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const inputContent = body.document_content || body.manual_requirements || body.input || '';

    if (!inputContent.trim()) {
      return NextResponse.json({ error: 'No input content provided' }, { status: 400 });
    }

    const llmConfig = body.provider
      ? buildConfigForProvider(body.provider as LLMProvider, body.model)
      : undefined;

    // Decide single-pass vs multi-pass.
    // Multi-pass kicks in for documents with >50KB of text (i.e. multi-domain FSDs)
    // unless explicitly disabled via body.options.multiPass = false.
    const optMultiPass = (body.options as { multiPass?: boolean } | undefined)?.multiPass;
    const multiPass = optMultiPass === true || (optMultiPass !== false && inputContent.length > 50_000);

    if (multiPass) {
      const { result, meta } = await runMultiPass(inputContent, body.document_name || 'Unknown', llmConfig, body.options);
      eventBus.publish(TOPICS.TEST_SCENARIO_CREATED, {
        input: inputContent,
        scenarioCount: result?.summary?.total ?? 0,
        timestamp: new Date().toISOString(),
      });
      return NextResponse.json({ ...result, _meta: meta });
    }

    // Single-pass (legacy path for small docs)
    const response = await processAI({
      service: 'scenario-gen',
      prompt: `Generate comprehensive test scenarios from the provided FSD/BRD/SRS document.
Document name: ${body.document_name || 'Unknown'}
Content length: ${inputContent.length} characters

Analyze the ACTUAL content below and generate test scenarios that are SPECIFIC to the requirements described. Do NOT generate generic placeholder scenarios.`,
      input: inputContent,
      options: body.options,
      llmConfig,
    });

    eventBus.publish(TOPICS.TEST_SCENARIO_CREATED, {
      input: inputContent,
      scenarioCount: (response.result as { summary?: { total?: number } })?.summary?.total ?? 0,
      timestamp: new Date().toISOString(),
    });

    const result = response.result as Record<string, unknown>;
    return NextResponse.json({
      ...result,
      _meta: {
        provider: response.provider,
        model: response.model,
        processingTime: response.processingTime,
        confidence: response.confidence,
        tokens: response.tokens,
        inputLength: inputContent.length,
        passes: 1,
      },
    });
  } catch (error) {
    console.error('scenario-gen error:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate test scenarios';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
