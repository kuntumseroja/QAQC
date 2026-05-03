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
  const planResult = planResp.result as { modules?: PlanModule[] };
  const modules = Array.isArray(planResult?.modules) ? planResult.modules : [];
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
