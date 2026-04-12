import { NextResponse } from 'next/server';
import { processAI } from '@/lib/ai-engine';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const response = await processAI({
      service: 'iac-review',
      prompt: 'Review infrastructure-as-code files for security vulnerabilities, misconfigurations, and best practice violations.',
      input: body.code || body.input || '',
      options: body.options,
    });

    return NextResponse.json(response.result);
  } catch (error) {
    console.error('iac-review error:', error);
    return NextResponse.json({ error: 'Failed to review IaC' }, { status: 500 });
  }
}
