import { NextResponse } from 'next/server';
import { processAI } from '@/lib/ai-engine';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const response = await processAI({
      service: 'security-scan',
      prompt: 'Scan for security compliance issues against CIS benchmarks and identify remediation steps.',
      input: body.input,
      options: body.options,
    });

    return NextResponse.json(response.result);
  } catch (error) {
    console.error('security-scan error:', error);
    return NextResponse.json({ error: 'Failed to run security scan' }, { status: 500 });
  }
}
