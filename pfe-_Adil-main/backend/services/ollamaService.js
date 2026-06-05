const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.1:8b';
const OLLAMA_TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS || 30000);

const askOllama = async ({ systemPrompt, userMessage, contextText }) => {
    if (typeof fetch !== 'function') {
        throw new Error('Fetch API is unavailable in this Node runtime');
    }

    const prompt = [
        systemPrompt,
        contextText ? `Contexte de reference:\n${contextText}` : '',
        `Question etudiant:\n${userMessage}`,
        'Reponse:'
    ].filter(Boolean).join('\n\n');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);

    try {
        const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: OLLAMA_MODEL,
                prompt,
                stream: false,
                options: {
                    temperature: 0.2,
                    top_p: 0.9
                }
            }),
            signal: controller.signal
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Ollama HTTP ${response.status}: ${text}`);
        }

        const data = await response.json();
        const answer = (data.response || '').trim();

        if (!answer) {
            throw new Error('Empty response from Ollama');
        }

        return {
            answer,
            model: data.model || OLLAMA_MODEL
        };
    } finally {
        clearTimeout(timeout);
    }
};

module.exports = {
    askOllama
};