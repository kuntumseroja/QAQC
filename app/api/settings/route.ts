import { NextResponse } from 'next/server';
import { AVAILABLE_MODELS } from '@/lib/ai-engine';

export async function GET() {
  return NextResponse.json({
    currentProvider: process.env.LLM_PROVIDER || 'mock',
    currentModel: process.env.LLM_PROVIDER === 'anthropic'
      ? (process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514')
      : process.env.LLM_PROVIDER === 'ollama'
      ? (process.env.OLLAMA_MODEL || 'llama3.1')
      : 'mock-engine',
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
    availableModels: AVAILABLE_MODELS,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Test Ollama connection
    if (body.action === 'test-ollama') {
      try {
        const baseUrl = body.baseUrl || 'http://localhost:11434';
        const res = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const models = data.models?.map((m: { name: string; size: number }) => ({
          id: m.name,
          name: m.name,
          size: m.size,
        })) || [];
        return NextResponse.json({ success: true, models, message: `Connected! ${models.length} models available.` });
      } catch (err) {
        return NextResponse.json({ success: false, models: [], message: `Cannot connect to Ollama at ${body.baseUrl || 'http://localhost:11434'}. Ensure Ollama is running.` });
      }
    }

    // Test Anthropic connection
    if (body.action === 'test-anthropic') {
      if (!body.apiKey && !process.env.ANTHROPIC_API_KEY) {
        return NextResponse.json({ success: false, message: 'API key is required' });
      }
      try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': body.apiKey || process.env.ANTHROPIC_API_KEY || '',
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 10,
            messages: [{ role: 'user', content: 'ping' }],
          }),
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) {
          const err = await res.text();
          throw new Error(err);
        }
        return NextResponse.json({ success: true, message: 'Anthropic API key is valid!' });
      } catch (err) {
        return NextResponse.json({ success: false, message: `Anthropic API error: ${err instanceof Error ? err.message : 'Unknown error'}` });
      }
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
