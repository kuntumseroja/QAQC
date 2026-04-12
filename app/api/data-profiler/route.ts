import { NextResponse } from 'next/server';
import { processAI } from '@/lib/ai-engine';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const response = await processAI({
      service: 'data-profiler',
      prompt: 'Profile the provided dataset and assess data quality across all dimensions.',
      input: body.sampleContent || body.datasetName || body.input || '',
      options: body.options,
    });

    return NextResponse.json(response.result);
  } catch (error) {
    console.error('data-profiler error:', error);
    return NextResponse.json({ error: 'Failed to profile data' }, { status: 500 });
  }
}
