import { NextResponse } from 'next/server';
import { AVAILABLE_MODELS } from '@/lib/ai-engine';

// Mask any sk-... API key found in a string so it never leaks into UI errors
function maskKeys(text: string): string {
  return text.replace(/sk-[A-Za-z0-9_-]{8,}/g, (m) => `${m.slice(0, 7)}…${m.slice(-4)}`);
}

export async function GET() {
  const provider = process.env.LLM_PROVIDER || 'mock';
  const currentModel =
    provider === 'anthropic' ? (process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514') :
    provider === 'deepseek' ? (process.env.DEEPSEEK_MODEL || 'deepseek-chat') :
    provider === 'ollama' ? (process.env.OLLAMA_MODEL || 'llama3.1') :
    'mock-engine';
  return NextResponse.json({
    currentProvider: provider,
    currentModel,
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    deepseekBaseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
    hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
    hasDeepseekKey: !!process.env.DEEPSEEK_API_KEY,
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
      } catch {
        return NextResponse.json({ success: false, models: [], message: `Cannot connect to Ollama at ${body.baseUrl || 'http://localhost:11434'}. Ensure Ollama is running.` });
      }
    }

    // Test Anthropic connection
    if (body.action === 'test-anthropic') {
      const apiKey = body.apiKey || process.env.ANTHROPIC_API_KEY || '';
      if (!apiKey) {
        return NextResponse.json({ success: false, message: 'API key is required' });
      }
      try {
        if (!apiKey.startsWith('sk-ant-')) {
          throw new Error('Invalid API key format — must start with sk-ant-');
        }
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'hi' }],
          }),
          signal: AbortSignal.timeout(15000),
        });
        if (res.status === 401 || res.status === 403) {
          const data = await res.json().catch(() => ({})) as { error?: { message?: string } };
          throw new Error(data?.error?.message || `Invalid API key (HTTP ${res.status})`);
        }
        // Any non-auth response (200, 400, 429, etc.) means the key was accepted
        return NextResponse.json({ success: true, message: 'Anthropic API key is valid!' });
      } catch (err) {
        const raw = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ success: false, message: `Anthropic API error: ${maskKeys(raw)}` });
      }
    }

    // Test DeepSeek connection
    if (body.action === 'test-deepseek') {
      const apiKey = body.apiKey || process.env.DEEPSEEK_API_KEY || '';
      if (!apiKey) {
        return NextResponse.json({ success: false, message: 'API key is required' });
      }
      try {
        if (!apiKey.startsWith('sk-')) {
          throw new Error('Invalid API key format — must start with sk-');
        }
        const baseUrl = body.baseUrl || process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
        const res = await fetch(`${baseUrl}/v1/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'deepseek-chat',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'hi' }],
          }),
          signal: AbortSignal.timeout(15000),
        });
        if (res.status === 401 || res.status === 403) {
          const data = await res.json().catch(() => ({})) as { error?: { message?: string } };
          throw new Error(data?.error?.message || `Invalid API key (HTTP ${res.status})`);
        }
        return NextResponse.json({ success: true, message: 'DeepSeek API key is valid!' });
      } catch (err) {
        const raw = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ success: false, message: `DeepSeek API error: ${maskKeys(raw)}` });
      }
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
