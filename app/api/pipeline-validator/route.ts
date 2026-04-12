import { NextResponse } from 'next/server';
import { processAI } from '@/lib/ai-engine';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const response = await processAI({
      service: 'pipeline-validator',
      prompt: 'Validate the ETL/data pipeline by running reconciliation checks between source and target.',
      input: [
        body.pipelineName ? `Pipeline: ${body.pipelineName}` : '',
        body.sourceQuery ? `=== SOURCE QUERY ===\n${body.sourceQuery}` : '',
        body.targetQuery ? `=== TARGET QUERY ===\n${body.targetQuery}` : '',
        body.transformSpec ? `=== TRANSFORMATION SPEC ===\n${body.transformSpec}` : '',
      ].filter(Boolean).join('\n\n') || body.input || '',
      options: body.options,
    });

    return NextResponse.json(response.result);
  } catch (error) {
    console.error('pipeline-validator error:', error);
    return NextResponse.json({ error: 'Failed to validate pipeline' }, { status: 500 });
  }
}
