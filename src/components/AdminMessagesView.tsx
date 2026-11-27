import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Inbox,
  LifeBuoy,
  Lightbulb,
  Rocket,
  Save,
  Trash2,
} from 'lucide-react';
import { deleteInboxItem, updateInboxItem } from '../lib/clubStore';
import type { InboxMessage, InboxMessageKind, InboxMessageStatus } from '../types';

interface AdminMessagesViewProps {
  messages: InboxMessage[];
}

function formatDateTimeRu(iso: string): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(dt);
}

const STATUS_META: Record<InboxMessageStatus, { label: string; colorClass: string }> = {
  new: { label: 'Новое', colorClass: 'text-orange-400' },
  accepted: { label: 'Принята, в разработке', colorClass: 'text-violet-400' },
  in_progress: { label: 'В работе', colorClass: 'text-amber-300' },
  done: { label: 'Решено', colorClass: 'text-emerald-400' },
};

export function AdminMessagesView({ messages }: AdminMessagesViewProps) {
  const [kindFilter, setKindFilter] = useState<'all' | InboxMessageKind>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | InboxMessageStatus>('all');
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const counts = useMemo(() => {
    let ideas = 0;
    let support = 0;
    let unread = 0;
    for (const m of messages) {
      if (m.kind === 'idea') ideas++;
      if (m.kind === 'support') support++;
      if (m.status === 'new') unread++;
    }
    return { total: messages.length, ideas, support, unread };
  }, [messages]);

  const filtered = useMemo(() => {
    return messages.filter((m) => {
      if (kindFilter !== 'all' && m.kind !== kindFilter) return false;
      if (statusFilter !== 'all' && m.status !== statusFilter) return false;
      return true;
    });
  }, [messages, kindFilter, statusFilter]);

  async function handleStatusChange(msg: InboxMessage, status: InboxMessageStatus) {
    setBusyId(msg.id);
    try {
      await updateInboxItem(msg, { status });
    } catch {
      // ignore
    } finally {
      setBusyId(null);
    }
  }

  async function handleSaveNote(msg: InboxMessage) {
    const draft = noteDrafts[msg.id] ?? msg.adminNote;
    setBusyId(msg.id);
    try {
      await updateInboxItem(msg, { adminNote: draft });
    } catch {
      // ignore
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(msg: InboxMessage) {
    setBusyId(msg.id);
    try {
      await deleteInboxItem(msg);
    } catch {
      // ignore
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 bg-[#121216]/90 backdrop-blur-md border border-zinc-800 rounded-xl divide-y lg:divide-y-0 lg:divide-x divide-zinc-800">
        <div className="p-5">
          <div className="text-xs text-zinc-400">Всего сообщений</div>
          <div className="mt-1.5 font-mono-num text-2xl font-semibold text-white">
            {counts.total}
          </div>
        </div>
        <div className="p-5">
          <div className="text-xs text-zinc-400">Новых (не разобрано)</div>
          <div className="mt-1.5 font-mono-num text-2xl font-semibold text-orange-400">
            {counts.unread}
          </div>
        </div>
        <div className="p-5">
          <div className="text-xs text-zinc-400">Идеи (/ides)</div>
          <div className="mt-1.5 font-mono-num text-2xl font-semibold text-white">
            {counts.ideas}
          </div>
        </div>
        <div className="p-5">
          <div className="text-xs text-zinc-400">Техподдержка (/Layf1x)</div>
          <div className="mt-1.5 font-mono-num text-2xl font-semibold text-white">
            {counts.support}
          </div>
        </div>
      </div>

      {/* Filters & Messages List */}
      <div className="bg-[#121216]/90 backdrop-blur-md border border-zinc-800 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-base font-bold text-white">
              Входящие из /ides и /Layf1x
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Все идеи учеников (1 ученик — 1 идея и 1 голос) и обращения в техподдержку собираются здесь.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 p-1 bg-[#09090B] border border-zinc-800 rounded-lg">
              {(
                [
                  { id: 'all', label: 'Все' },
                  { id: 'idea', label: 'Идеи (/ides)' },
                  { id: 'support', label: 'Поддержка (/Layf1x)' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setKindFilter(tab.id)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    kindFilter === tab.id
                      ? 'bg-orange-600 text-white'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | InboxMessageStatus)}
              className="px-3 py-1.5 text-xs bg-[#09090B] text-zinc-200 border border-zinc-800 rounded-lg focus:outline-none focus:border-orange-500"
            >
              <option value="all">Любой статус</option>
              <option value="new">Только новые</option>
              <option value="accepted">Принята, в разработке</option>
              <option value="in_progress">В работе</option>
              <option value="done">Решённые</option>
            </select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="py-12 px-6 text-center space-y-2">
            <Inbox className="w-8 h-8 text-zinc-600 mx-auto" />
            <div className="text-sm text-zinc-400">Сообщений по выбранному фильтру пока нет.</div>
            <div className="text-xs text-zinc-500">
              Ученики могут отправлять идеи на /ides и писать в поддержку на /Layf1x.
            </div>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/80">
            {filtered.map((msg) => {
              const isIdea = msg.kind === 'idea';
              const meta = STATUS_META[msg.status] ?? STATUS_META.new;
              const currentNote = noteDrafts[msg.id] ?? msg.adminNote;
              const noteChanged = currentNote !== msg.adminNote;

              return (
                <div
                  key={`${msg.kind}_${msg.id}`}
                  className="p-5 space-y-4 hover:bg-zinc-900/40 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap text-xs">
                        <span
                          className={`inline-flex items-center gap-1 font-semibold ${
                            isIdea ? 'text-orange-400' : 'text-sky-400'
                          }`}
                        >
                          {isIdea ? (
                            <Lightbulb className="w-3.5 h-3.5" />
                          ) : (
                            <LifeBuoy className="w-3.5 h-3.5" />
                          )}
                          {isIdea ? 'Идея (/ides)' : 'Поддержка (/Layf1x)'}
                        </span>
                        <span className="text-zinc-600">·</span>
                        <span className={`font-medium ${meta.colorClass}`}>{meta.label}</span>
                        {isIdea && (
                          <>
                            <span className="text-zinc-600">·</span>
                            <span className="inline-flex items-center gap-2 font-mono-num font-semibold">
                              <span className="inline-flex items-center gap-0.5 text-orange-300">
                                <ChevronUp className="w-3.5 h-3.5" />
                                {msg.upvotes}
                              </span>
                              <span className="inline-flex items-center gap-0.5 text-red-400">
                                <ChevronDown className="w-3.5 h-3.5" />
                                {msg.downvotes}
                              </span>
                            </span>
                          </>
                        )}
                        <span className="text-zinc-600">·</span>
                        <span className="font-mono-num text-zinc-500">
                          {formatDateTimeRu(msg.createdAt)}
                        </span>
                      </div>

                      <h3 className="font-display text-base font-bold text-white">
                        {msg.subject}
                      </h3>

                      <div className="text-xs text-zinc-400">
                        От: <span className="text-zinc-200 font-medium">{msg.authorName}</span>
                        {msg.authorContact && (
                          <>
                            <span className="mx-1.5 text-zinc-600">·</span>
                            <span>{msg.authorContact}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Status Controls + Delete */}
                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                      {isIdea && (
                        <button
                          type="button"
                          disabled={busyId === msg.id}
                          onClick={() => handleStatusChange(msg, 'accepted')}
                          title="Принять идею в разработку"
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50 ${
                            msg.status === 'accepted'
                              ? 'bg-violet-950/60 border-violet-600 text-violet-300'
                              : 'bg-[#09090B] border-zinc-800 text-zinc-400 hover:text-white'
                          }`}
                        >
                          <Rocket className="w-3.5 h-3.5" />
                          Принята, в разработке
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={busyId === msg.id}
                        onClick={() => handleStatusChange(msg, 'in_progress')}
                        title="Взять в работу"
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50 ${
                          msg.status === 'in_progress'
                            ? 'bg-amber-950/60 border-amber-700 text-amber-300'
                            : 'bg-[#09090B] border-zinc-800 text-zinc-400 hover:text-white'
                        }`}
                      >
                        <Clock className="w-3.5 h-3.5" />
                        В работе
                      </button>

                      <button
                        type="button"
                        disabled={busyId === msg.id}
                        onClick={() => handleStatusChange(msg, 'done')}
                        title="Отметить решённым"
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors cursor-pointer disabled:opacity-50 ${
                          msg.status === 'done'
                            ? 'bg-emerald-950/60 border-emerald-700 text-emerald-300'
                            : 'bg-[#09090B] border-zinc-800 text-zinc-400 hover:text-white'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Решено
                      </button>

                      <button
                        type="button"
                        disabled={busyId === msg.id}
                        onClick={() => handleDelete(msg)}
                        aria-label="Удалить сообщение"
                        className="p-1.5 text-zinc-500 hover:text-red-400 rounded-md cursor-pointer disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap bg-[#09090B]/80 border border-zinc-800/80 rounded-lg p-3.5">
                    {msg.message}
                  </p>

                  {/* Internal Coach/Admin Note */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <input
                      type="text"
                      maxLength={500}
                      value={currentNote}
                      onChange={(e) =>
                        setNoteDrafts((prev) => ({ ...prev, [msg.id]: e.target.value }))
                      }
                      placeholder="Заметка администратора (видна только в /admin)..."
                      className="flex-1 px-3 py-1.5 text-xs bg-[#09090B] text-zinc-200 placeholder:text-zinc-600 border border-zinc-800 rounded-lg focus:outline-none focus:border-orange-500"
                    />
                    {noteChanged && (
                      <button
                        type="button"
                        disabled={busyId === msg.id}
                        onClick={() => handleSaveNote(msg)}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-orange-600 hover:bg-orange-500 rounded-lg cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <Save className="w-3.5 h-3.5" />
                        Сохранить заметку
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
