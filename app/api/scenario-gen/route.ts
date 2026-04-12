import { NextResponse } from 'next/server';
import { processAI } from '@/lib/ai-engine';
import { eventBus, TOPICS } from '@/lib/event-bus';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const inputContent = body.document_content || body.manual_requirements || body.input || '';

    if (!inputContent.trim()) {
      return NextResponse.json({ error: 'No input content provided' }, { status: 400 });
    }

    const response = await processAI({
      service: 'scenario-gen',
      prompt: `Generate comprehensive test scenarios from the provided FSD/BRD/SRS document.
Document name: ${body.document_name || 'Unknown'}
Content length: ${inputContent.length} characters

Analyze the ACTUAL content below and generate test scenarios that are SPECIFIC to the requirements described. Do NOT generate generic placeholder scenarios.`,
      input: inputContent,
      options: body.options,
    });

    eventBus.publish(TOPICS.TEST_SCENARIO_CREATED, {
      input: inputContent,
      scenarioCount: (response.result as { summary?: { total?: number } })?.summary?.total ?? 0,
      timestamp: new Date().toISOString(),
    });

    // Include provider metadata so the UI knows if real LLM or mock was used
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
      },
    });
  } catch (error) {
    console.error('scenario-gen error:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate test scenarios';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
