import { NextResponse } from 'next/server';
import { processAI } from '@/lib/ai-engine';
import { eventBus, TOPICS } from '@/lib/event-bus';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const response = await processAI({
      service: 'defect-classifier',
      prompt: 'Classify the defect by severity, priority, and root cause, and identify similar historical defects.',
      input: [body.description, body.logs].filter(Boolean).join('\n\nLOGS:\n') || body.input || '',
      options: body.options,
    });

    eventBus.publish(TOPICS.DEFECT_CLASSIFIED, {
      input: [body.description, body.logs].filter(Boolean).join('\n\nLOGS:\n') || body.input || '',
      classification: response.result,
      confidence: response.confidence,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(response.result);
  } catch (error) {
    console.error('defect-classifier error:', error);
    return NextResponse.json({ error: 'Failed to classify defect' }, { status: 500 });
  }
}
