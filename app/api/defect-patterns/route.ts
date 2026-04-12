import { NextResponse } from 'next/server';
import { processAI } from '@/lib/ai-engine';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const response = await processAI({
      service: 'defect-patterns',
      prompt: 'Analyze defect patterns to produce a risk heatmap, trend analysis, and root cause distribution.',
      input: body.period || body.input || 'Last 6 months',
      options: body.options,
    });

    return NextResponse.json(response.result);
  } catch (error) {
    console.error('defect-patterns error:', error);
    return NextResponse.json({ error: 'Failed to analyze defect patterns' }, { status: 500 });
  }
}
