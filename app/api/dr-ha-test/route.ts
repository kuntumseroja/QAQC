import { NextResponse } from 'next/server';
import { processAI } from '@/lib/ai-engine';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const response = await processAI({
      service: 'dr-ha-test',
      prompt: 'Generate disaster recovery and high availability test scenarios with RTO/RPO targets and runbooks.',
      input: [body.architectureDescription, body.rpoTarget ? 'RPO: ' + body.rpoTarget : '', body.rtoTarget ? 'RTO: ' + body.rtoTarget : ''].filter(Boolean).join('\n') || body.input || '',
      options: body.options,
    });

    return NextResponse.json(response.result);
  } catch (error) {
    console.error('dr-ha-test error:', error);
    return NextResponse.json({ error: 'Failed to generate DR/HA test scenarios' }, { status: 500 });
  }
}
