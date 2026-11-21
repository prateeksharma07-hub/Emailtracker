/**
 * Unified LLM & Transformer Client (MailMind AI)
 * 
 * Provides an injectable interface for Groq inference and Prompt Guard 2 scanning.
 * In production: Dispatches HTTP calls to Groq API with retries and timeout guards.
 * In testing / simulation: Can be swapped with a deterministic mock provider.
 */

let activeProvider = null;

/**
 * Standard Live Groq Provider
 */
const liveGroqProvider = {
  name: 'live-groq',

  async chatCompletion({ model = process.env.GROQ_CHAT_MODEL || 'openai/gpt-oss-20b', messages, temperature = 0.2, jsonMode = false, timeoutMs = 12000 }) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error('GROQ_API_KEY is not configured in environment.');
    }

    const payload = {
      model,
      messages,
      temperature
    };

    if (jsonMode) {
      payload.response_format = { type: 'json_object' };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      if (!res.ok) {
        const errorText = await res.text();
        const err = new Error(`Groq API responded with status ${res.status}: ${errorText}`);
        err.status = res.status;
        throw err;
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content || '';
      return {
        content,
        modelUsed: data.model || model,
        usage: data.usage || null
      };
    } finally {
      clearTimeout(timeout);
    }
  },

  async scanPromptGuard({ chunk, model = 'meta-llama/llama-prompt-guard-2-22m', timeoutMs = 8000 }) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error('GROQ_API_KEY not configured for Prompt Guard.');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: chunk }],
          temperature: 0.0
        }),
        signal: controller.signal
      });

      if (!res.ok) {
        const errText = await res.text();
        const err = new Error(`Groq Prompt Guard HTTP ${res.status}: ${errText}`);
        err.status = res.status;
        throw err;
      }

      const data = await res.json();
      const rawContent = data.choices?.[0]?.message?.content?.trim();
      const score = parseFloat(rawContent);

      if (isNaN(score)) {
        throw new Error(`Unexpected non-numeric response from Prompt Guard: "${rawContent}"`);
      }

      return score;
    } finally {
      clearTimeout(timeout);
    }
  }
};

/**
 * Get the currently active provider
 */
export function getLLMProvider() {
  return activeProvider || liveGroqProvider;
}

/**
 * Inject a custom or mock LLM provider (e.g. for unit tests)
 */
export function setLLMProvider(provider) {
  activeProvider = provider;
}

/**
 * Reset back to standard live Groq provider
 */
export function resetLLMProvider() {
  activeProvider = null;
}

/**
 * High-level chat completion wrapper
 */
export async function chatCompletion(options) {
  const provider = getLLMProvider();
  return provider.chatCompletion(options);
}

/**
 * High-level prompt guard scan wrapper
 */
export async function scanPromptGuard(options) {
  const provider = getLLMProvider();
  return provider.scanPromptGuard(options);
}
