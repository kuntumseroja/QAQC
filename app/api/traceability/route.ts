import { NextResponse } from 'next/server';
import { processAI } from '@/lib/ai-engine';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const response = await processAI({
      service: 'traceability',
      prompt: 'Generate a traceability matrix mapping requirements to test cases and identify coverage gaps.',
      input: body.document_content || body.manual_requirements || body.input || '',
      options: body.options,
    });

    return NextResponse.json(response.result);
  } catch (error) {
    console.error('traceability error:', error);
    return NextResponse.json({ error: 'Failed to generate traceability matrix' }, { status: 500 });
  }
}
