import { NextResponse } from 'next/server';
import { processAI } from '@/lib/ai-engine';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const inputContent = body.test_steps || body.input || '';
    const framework = body.framework || 'Selenium';

    if (!inputContent.trim()) {
      return NextResponse.json({ error: 'No test steps provided' }, { status: 400 });
    }

    const response = await processAI({
      service: 'automation-codegen',
      prompt: `Generate ${framework} automation test code using Page Object Model pattern from the provided manual test steps.
Framework: ${framework}`,
      input: inputContent,
      options: { framework, ...body.options },
    });

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
    console.error('automation-codegen error:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate automation code';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
