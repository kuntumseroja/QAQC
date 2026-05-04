import { NextResponse } from 'next/server';
import { processAI, buildConfigForProvider, type LLMProvider } from '@/lib/ai-engine';
import { eventBus, TOPICS } from '@/lib/event-bus';

export const runtime = 'nodejs';
export const maxDuration = 120;

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

interface PlanModule {
  name: string;
  chapter?: string;
  summary?: string;
  expectedScenarios?: number;
}

// ---- MODE: plan ----
// Single LLM call to enumerate the modules in the document.
async function runPlan(
  inputContent: string,
  documentName: string,
  llmConfig: ReturnType<typeof buildConfigForProvider> | undefined,
  options: Record<string, unknown> | undefined,
) {
  const startTime = Date.now();
  const planResp = await processAI({
    service: 'scenario-plan',  // dedicated planning system prompt — small models follow this better
    prompt: `Document: ${documentName} (${inputContent.length} characters).

List the distinct user stories / modules / functional areas in the document below as JSON only. Aim for 8-20 entries.`,
    input: inputContent,
    options,
    llmConfig,
  });
  // Accept any of these shapes the LLM might return:
  //   { modules: [...] }
  //   { user_stories: [...] } / { userStories: [...] }
  //   { stories: [...] }
  //   [...] (top-level array)
  //   { anything: [{name|title|story|module: ..., summary?}, ...] } — first array of objects
  const raw = planResp.result as Record<string, unknown>;
  let arr: unknown[] = [];
  if (Array.isArray(raw)) {
    arr = raw;
  } else if (raw && typeof raw === 'object') {
    const candidates = ['modules', 'user_stories', 'userStories', 'stories', 'features', 'functional_areas', 'items'];
    for (const k of candidates) {
      if (Array.isArray((raw as Record<string, unknown>)[k])) {
        arr = (raw as Record<string, unknown[]>)[k];
        break;
      }
    }
    if (arr.length === 0) {
      // Last-resort: pick the first array-of-objects we find
      for (const k of Object.keys(raw)) {
        const v = (raw as Record<string, unknown>)[k];
        if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'object') {
          arr = v;
          break;
        }
      }
    }
  }

  // Normalize each entry to PlanModule shape (tolerate name/title/story/module keys).
  const modules: PlanModule[] = (arr as Record<string, unknown>[])
    .map((m) => ({
      name: String(m.name || m.title || m.story || m.module || m.feature || m.area || '').trim(),
      chapter: m.chapter ? String(m.chapter) : (m.section ? String(m.section) : (m.ref ? String(m.ref) : undefined)),
      summary: m.summary ? String(m.summary) : (m.description ? String(m.description) : (m.desc ? String(m.desc) : undefined)),
      expectedScenarios: typeof m.expectedScenarios === 'number' ? m.expectedScenarios
        : typeof m.expected_scenarios === 'number' ? m.expected_scenarios as number
        : typeof m.scenarios === 'number' ? m.scenarios as number
        : 10,
    }))
    .filter(m => m.name.length > 0);

  console.log(`[scenario-gen plan] provider=${planResp.provider} model=${planResp.model} returned ${modules.length} module(s) from raw keys=${Object.keys(raw || {}).join(',')}`);

  return {
    modules,
    _meta: {
      provider: planResp.provider,
      model: planResp.model,
      processingTime: Date.now() - startTime,
      tokens: planResp.tokens,
      inputLength: inputContent.length,
      mode: 'plan',
    },
  };
}

// ---- MODE: generate-module ----
// Generate scenarios for one specific module.
async function runGenerateModule(
  inputContent: string,
  documentName: string,
  mod: PlanModule,
  llmConfig: ReturnType<typeof buildConfigForProvider> | undefined,
  options: Record<string, unknown> | undefined,
) {
  const startTime = Date.now();
  const moduleScenarioCount = Math.max(5, Math.min(20, mod.expectedScenarios || 10));
  const resp = await processAI({
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
  });
  const result = resp.result as ScenarioResult;
  return {
    ...result,
    _meta: {
      provider: resp.provider,
      model: resp.model,
      processingTime: Date.now() - startTime,
      confidence: resp.confidence,
      tokens: resp.tokens,
      inputLength: inputContent.length,
      mode: 'generate-module',
      module: mod.name,
    },
  };
}

// ---- MODE: single (legacy / small doc) ----
async function runSingle(
  inputContent: string,
  documentName: string,
  llmConfig: ReturnType<typeof buildConfigForProvider> | undefined,
  options: Record<string, unknown> | undefined,
) {
  const startTime = Date.now();
  const resp = await processAI({
    service: 'scenario-gen',
    prompt: `Generate comprehensive test scenarios from the provided FSD/BRD/SRS document.
Document name: ${documentName}
Content length: ${inputContent.length} characters

Analyze the ACTUAL content below and generate test scenarios that are SPECIFIC to the requirements described. Do NOT generate generic placeholder scenarios.`,
    input: inputContent,
    options,
    llmConfig,
  });
  const result = resp.result as ScenarioResult;
  return {
    ...result,
    _meta: {
      provider: resp.provider,
      model: resp.model,
      processingTime: Date.now() - startTime,
      confidence: resp.confidence,
      tokens: resp.tokens,
      inputLength: inputContent.length,
      mode: 'single',
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

    const documentName = body.document_name || 'Unknown';
    const mode = (body.mode || body.action) as ('plan' | 'generate-module' | 'single' | undefined);

    // Mode: plan — return module list only
    if (mode === 'plan') {
      const result = await runPlan(inputContent, documentName, llmConfig, body.options);
      return NextResponse.json(result);
    }

    // Mode: generate-module — generate for one module supplied by caller
    if (mode === 'generate-module') {
      const mod = body.module as PlanModule | undefined;
      if (!mod || !mod.name) {
        return NextResponse.json({ error: 'module is required when mode=generate-module' }, { status: 400 });
      }
      const result = await runGenerateModule(inputContent, documentName, mod, llmConfig, body.options);

      eventBus.publish(TOPICS.TEST_SCENARIO_CREATED, {
        input: inputContent,
        scenarioCount: (result?.summary?.total) ?? (Array.isArray(result?.scenarios) ? result.scenarios!.length : 0),
        timestamp: new Date().toISOString(),
      });

      return NextResponse.json(result);
    }

    // Default / legacy — single pass for small docs or backward compat
    const result = await runSingle(inputContent, documentName, llmConfig, body.options);

    eventBus.publish(TOPICS.TEST_SCENARIO_CREATED, {
      input: inputContent,
      scenarioCount: result?.summary?.total ?? 0,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('scenario-gen error:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate test scenarios';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
