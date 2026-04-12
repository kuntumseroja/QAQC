import { NextResponse } from 'next/server';
import { processAI } from '@/lib/ai-engine';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const response = await processAI({
      service: 'viz-validator',
      prompt: 'Validate dashboard visualizations against specifications for accuracy, accessibility, and design standards.',
      input: [body.dashboardName, body.dataQuery].filter(Boolean).join('\n') || body.input || '',
      options: body.options,
    });

    return NextResponse.json(response.result);
  } catch (error) {
    console.error('viz-validator error:', error);
    return NextResponse.json({ error: 'Failed to validate visualization' }, { status: 500 });
  }
}
