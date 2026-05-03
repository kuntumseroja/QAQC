import { NextResponse } from 'next/server';
import { processAI, buildConfigForProvider, type LLMProvider } from '@/lib/ai-engine';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const llmConfig = body.provider
      ? buildConfigForProvider(body.provider as LLMProvider, body.model)
      : undefined;

    const response = await processAI({
      service: 'data-profiler',
      prompt: 'Profile the provided dataset and assess data quality across all dimensions. For Indonesian banking columns, check format rules: NIK = exactly 16 digits, NPWP = XX.XXX.XXX.X-XXX.XXX dotted format (NOT hyphen), email = RFC-5322, phone = starts with 08 or +628, dates = ISO YYYY-MM-DD.',
      input: body.sampleContent || body.datasetName || body.input || '',
      options: body.options,
      llmConfig,
    });

    return NextResponse.json(response.result);
  } catch (error) {
    console.error('data-profiler error:', error);
    const message = error instanceof Error ? error.message : 'Failed to profile data';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
