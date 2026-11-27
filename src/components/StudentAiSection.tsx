import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Send, Sparkles, Trash2 } from 'lucide-react';
import { apiRequest } from '../lib/api';
import {
  clearStudentAiHistory,
  generateDocId,
  loadStudentAiHistory,
  saveStudentAiHistory,
} from '../lib/clubStore';
import type { StudentAiMessage, StudentSession } from '../types';

interface StudentAiSectionProps {
  studentSession: StudentSession;
  studentName: string;
  groupName: string;
  totalPoints: number;
}

const QUICK_PROMPTS = [
  'Объясни, что такое вилка и связка, на простом примере',
  'Дай тактическую задачу для тренировки с подсказкой',
  'Какие главные правила нужно помнить в дебюте?',
  'Как поставить мат королём и ладьёй?',
];

export function StudentAiSection({
  studentSession,
  studentName,
  groupName,
  totalPoints,
}: StudentAiSectionProps) {
  const [messages, setMessages] = useState<StudentAiMessage[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;
    setLoadingHistory(true);
    setError(null);
    loadStudentAiHistory(studentSession.authKey)
      .then((list) => {
        if (active) setMessages(list);
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Не удалось загрузить историю чата');
        }
      })
      .finally(() => {
        if (active) setLoadingHistory(false);
      });
    return () => {
      active = false;
    };
  }, [studentSession.authKey]);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, sending]);

  async function sendQuestion(questionText: string) {
    const trimmed = questionText.trim();
    if (!trimmed || sending) return;

    setError(null);
    setSending(true);
    setInput('');

    const userMsg: StudentAiMessage = {
      id: generateDocId('u'),
      role: 'user',
      content: trimmed,
      createdAt: new Date().toISOString(),
    };
    const nextWithUser = [...messages, userMsg];
    setMessages(nextWithUser);

    try {
      const res = await apiRequest<{ reply: string }>('/api/student/ai-chat', {
        method: 'POST',
        body: {
          studentName,
          groupName,
          totalPoints,
          message: trimmed,
          history: messages.slice(-16).map((m) => ({
            role: m.role,
            content: m.content,
          })),
        },
      });

      const assistantMsg: StudentAiMessage = {
        id: generateDocId('a'),
        role: 'model',
        content: res.reply,
        createdAt: new Date().toISOString(),
      };
      const updated = [...nextWithUser, assistantMsg].slice(-40);
      setMessages(updated);
      await saveStudentAiHistory(studentSession.authKey, studentSession.studentId, updated);
    } catch (err) {
      setMessages(messages);
      setInput(trimmed);
      setError(err instanceof Error ? err.message : 'Не удалось получить ответ помощника');
    } finally {
      setSending(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendQuestion(input);
  }

  async function handleClearHistory() {
    if (sending) return;
    setError(null);
    try {
      await clearStudentAiHistory(studentSession.authKey);
      setMessages([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось очистить историю');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-bold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-orange-400" />
            Шахматный помощник Layf1x-TOP
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Задайте вопрос по дебютам, тактике, эндшпилю или попросите разобрать ход.
          </p>
        </div>

        {messages.length > 0 && (
          <button
            type="button"
            onClick={handleClearHistory}
            disabled={sending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-red-400 border border-zinc-800 hover:border-red-900/70 rounded-lg transition-colors self-start sm:self-auto cursor-pointer disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Очистить диалог
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-950/60 border border-red-900 rounded-lg text-xs text-red-300">
          {error}
        </div>
      )}

      {/* Chat Messages Area */}
      <div className="bg-[#09090B] border border-zinc-800 rounded-xl p-4 h-[360px] overflow-y-auto space-y-4">
        {loadingHistory ? (
          <div className="h-full flex items-center justify-center text-xs text-zinc-500 gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-orange-400" />
            Загрузка диалога...
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4 space-y-4">
            <div className="space-y-1.5 max-w-md">
              <div className="text-sm font-medium text-white">
                Привет, {studentName.split(' ')[0]}! Чем помочь сегодня?
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Можно спросить о шахматных приёмах, попросить придумать задачу или разобрать сложную позицию.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-xl">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => sendQuestion(prompt)}
                  disabled={sending}
                  className="text-left px-3 py-2 text-xs text-zinc-300 hover:text-white bg-[#121216] hover:bg-zinc-900 border border-zinc-800 hover:border-orange-500/50 rounded-lg transition-colors cursor-pointer"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                      isUser
                        ? 'bg-orange-600 text-white'
                        : 'bg-[#14141A] border border-zinc-800 text-zinc-200'
                    }`}
                  >
                    <div
                      className={`text-[11px] font-medium mb-1 ${
                        isUser ? 'text-orange-100/90' : 'text-orange-400'
                      }`}
                    >
                      {isUser ? 'Вы' : 'Помощник Layf1x-TOP'}
                    </div>
                    {msg.content}
                  </div>
                </div>
              );
            })}

            {sending && (
              <div className="flex justify-start">
                <div className="bg-[#14141A] border border-zinc-800 rounded-xl px-4 py-3 text-xs text-zinc-400 inline-flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-400" />
                  Помощник обдумывает ответ...
                </div>
              </div>
            )}
            <div ref={scrollEndRef} />
          </>
        )}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2.5">
        <input
          type="text"
          maxLength={2000}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={sending}
          placeholder="Напишите вопрос помощнику..."
          className="flex-1 px-4 py-2.5 text-sm bg-[#09090B] text-white placeholder:text-zinc-600 border border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-orange-600 hover:bg-orange-500 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Send className="w-4 h-4" />
          Отправить
        </button>
      </form>
    </div>
  );
}
