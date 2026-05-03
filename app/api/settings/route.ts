import { NextResponse } from 'next/server';
import { AVAILABLE_MODELS } from '@/lib/ai-engine';
import { execSync } from 'child_process';

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
        const apiKey = body.apiKey || process.env.ANTHROPIC_API_KEY || '';
        if (!apiKey.startsWith('sk-ant-')) {
          throw new Error('Invalid API key format — must start with sk-ant-');
        }
        // Use curl to verify key (avoids Next.js Turbopack fetch issues)
        const result = execSync(
          `curl -s --max-time 10 -X POST https://api.anthropic.com/v1/messages ` +
          `-H 'Content-Type: application/json' ` +
          `-H 'x-api-key: ${apiKey}' ` +
          `-H 'anthropic-version: 2023-06-01' ` +
          `-d '{"model":"claude-sonnet-4-20250514","max_tokens":1,"messages":[{"role":"user","content":"hi"}]}'`,
          { encoding: 'utf-8', timeout: 15000 }
        );
        const parsed = JSON.parse(result);
        if (parsed.type === 'error' && parsed.error?.type === 'authentication_error') {
          throw new Error(parsed.error.message || 'Invalid API key');
        }
        return NextResponse.json({ success: true, message: 'Anthropic API key is valid!' });
      } catch (err) {
        return NextResponse.json({ success: false, message: `Anthropic API error: ${err instanceof Error ? err.message : 'Unknown error'}` });
      }
    }

    // Test DeepSeek connection
    if (body.action === 'test-deepseek') {
      if (!body.apiKey && !process.env.DEEPSEEK_API_KEY) {
        return NextResponse.json({ success: false, message: 'API key is required' });
      }
      try {
        const apiKey = body.apiKey || process.env.DEEPSEEK_API_KEY || '';
        // DeepSeek keys typically start with 'sk-' (OpenAI-style)
        if (!apiKey.startsWith('sk-')) {
          throw new Error('Invalid API key format — must start with sk-');
        }
        const baseUrl = body.baseUrl || process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
        // Use curl to verify key (avoids Next.js Turbopack fetch issues)
        const result = execSync(
          `curl -s --max-time 10 -X POST ${baseUrl}/v1/chat/completions ` +
          `-H 'Content-Type: application/json' ` +
          `-H 'Authorization: Bearer ${apiKey}' ` +
          `-d '{"model":"deepseek-chat","max_tokens":1,"messages":[{"role":"user","content":"hi"}]}'`,
          { encoding: 'utf-8', timeout: 15000 }
        );
        const parsed = JSON.parse(result);
        if (parsed.error) {
          throw new Error(parsed.error.message || parsed.error.code || 'Invalid API key');
        }
        return NextResponse.json({ success: true, message: 'DeepSeek API key is valid!' });
      } catch (err) {
        return NextResponse.json({ success: false, message: `DeepSeek API error: ${err instanceof Error ? err.message : 'Unknown error'}` });
      }
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
