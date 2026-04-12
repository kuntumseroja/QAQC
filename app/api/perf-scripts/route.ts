import { NextResponse } from 'next/server';
import { processAI } from '@/lib/ai-engine';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const inputContent = body.spec_content || body.input || '';
    const tool = body.tool || 'JMeter';
    const testType = body.test_type || body.testType || 'Load';

    if (!inputContent.trim()) {
      return NextResponse.json({ error: 'No specification content provided' }, { status: 400 });
    }

    const response = await processAI({
      service: 'perf-scripts',
      prompt: `Generate a ${tool} ${testType} test script from this OpenAPI/Swagger specification.
Tool: ${tool}
Test Type: ${testType}
Spec name: ${body.spec_name || 'Unknown'}`,
      input: inputContent,
      options: {
        tool,
        testType,
        ...body.options,
      },
    });

    // Include provider metadata
    const result = response.result as Record<string, unknown>;
    return NextResponse.json({
      ...result,
      _meta: {
        provider: response.provider,
        model: response.model,
        processingTime: response.processingTime,
      },
    });
  } catch (error) {
    console.error('perf-scripts error:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate performance test script';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
