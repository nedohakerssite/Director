import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express from 'express';
import type { Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

function createAiClient(): GoogleGenAI | null {
  const apiKey = (process.env.GEMINI_API_KEY ?? '').trim();
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function normalizeString(val: unknown, maxLen: number): string {
  if (typeof val !== 'string') return '';
  return val.trim().slice(0, maxLen);
}

// Simple in-memory rate limit for AI helper endpoint
const aiRateMap = new Map<string, number[]>();
const AI_RATE_WINDOW_MS = 60 * 1000;
const AI_RATE_MAX = 15;

function checkAiRateLimit(req: Request): boolean {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const stamps = (aiRateMap.get(ip) ?? []).filter((t) => now - t < AI_RATE_WINDOW_MS);
  if (stamps.length >= AI_RATE_MAX) {
    aiRateMap.set(ip, stamps);
    return false;
  }
  stamps.push(now);
  aiRateMap.set(ip, stamps);
  return true;
}

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

// Prevent any stale caching on API responses
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Server-side Student Chess AI Helper (/api/student/ai-chat)
// ---------------------------------------------------------------------------
app.post('/api/student/ai-chat', async (req: Request, res: Response) => {
  if (!checkAiRateLimit(req)) {
    res.status(429).json({
      error: 'Слишком много запросов подряд. Подождите минуту и попробуйте снова.',
    });
    return;
  }

  const message = normalizeString(req.body?.message, 2000);
  if (!message) {
    res.status(400).json({ error: 'Введите вопрос для шахматного помощника' });
    return;
  }

  const studentName = normalizeString(req.body?.studentName, 100) || 'Ученик';
  const groupName = normalizeString(req.body?.groupName, 60) || 'Начинающие';
  const totalPoints = Number.isFinite(Number(req.body?.totalPoints))
    ? Math.trunc(Number(req.body.totalPoints))
    : 0;

  const rawHistory = Array.isArray(req.body?.history) ? req.body.history.slice(-16) : [];
  const historyParts: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
  for (const item of rawHistory) {
    if (!item || typeof item !== 'object') continue;
    const role = (item as { role?: unknown }).role === 'model' ? 'model' : 'user';
    const content = normalizeString((item as { content?: unknown }).content, 3000);
    if (content) {
      historyParts.push({ role, parts: [{ text: content }] });
    }
  }

  const ai = createAiClient();
  if (!ai) {
    res.status(503).json({
      error: 'API-ключ для ответов помощника не настроен на сервере (GEMINI_API_KEY).',
    });
    return;
  }

  const contents = [
    ...historyParts,
    {
      role: 'user' as const,
      parts: [{ text: message }],
    },
  ];

  const systemInstruction = [
    'Ты — дружелюбный и грамотный шахматный помощник клуба «Layf1x-TOP».',
    `Ты общаешься с учеником: ${studentName} (группа: ${groupName}, текущие баллы: ${totalPoints}).`,
    'Помогай с шахматными правилами, тактическими приёмами (вилка, связка, двойной удар, вскрытый шах, рентген), дебютами, эндшпилем, разбором партий и учебными задачами, а также отвечай на общие учебные вопросы вежливо и понятно.',
    'Отвечай на русском языке, структурированно и лаконично (обычно 2–6 коротких абзацев или списком ходов), без лишней воды.',
    'Используй стандартную шахматную нотацию, когда приводишь ходы (например: 1. e4 e5 2. Кf3 Кc6).',
  ].join(' ');

  let replyText = '';
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents,
        config: {
          systemInstruction,
        },
      });
      replyText = (response.text ?? '').trim();
      if (replyText) {
        lastError = null;
        break;
      }
      lastError = new Error('Пустой ответ от сервиса');
    } catch (err) {
      lastError = err;
      const errMsg = err instanceof Error ? err.message : String(err);
      const isRetryable =
        errMsg.includes('429') ||
        errMsg.includes('503') ||
        errMsg.includes('500') ||
        errMsg.includes('UNAVAILABLE');
      if (!isRetryable || attempt === 2) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 600 * (attempt + 1)));
    }
  }

  if (lastError || !replyText) {
    const rawMsg = lastError instanceof Error ? lastError.message : 'Не удалось получить ответ';
    console.error('AI chat error:', rawMsg);
    if (
      rawMsg.includes('API_KEY_INVALID') ||
      rawMsg.includes('PERMISSION_DENIED') ||
      rawMsg.includes('403')
    ) {
      res.status(502).json({
        error: 'Ошибка авторизации API на сервере. Проверьте ключ в настройках секретов.',
      });
      return;
    }
    if (rawMsg.includes('RESOURCE_EXHAUSTED') || rawMsg.includes('429')) {
      res.status(429).json({
        error: 'Превышен лимит запросов к помощнику. Попробуйте написать чуть позже.',
      });
      return;
    }
    res.status(502).json({
      error: 'Помощник временно недоступен. Попробуйте отправить сообщение ещё раз.',
    });
    return;
  }

  res.json({ reply: replyText });
});

// ---------------------------------------------------------------------------
// Frontend Serving (Vite middleware in dev, dist/ static in prod)
// ---------------------------------------------------------------------------
async function startServer(): Promise<void> {
  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) {
        next();
        return;
      }
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API маршрут не найден' });
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Layf1x-TOP server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
