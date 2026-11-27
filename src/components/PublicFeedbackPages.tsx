import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  LifeBuoy,
  Lightbulb,
  Lock,
  LogIn,
  Rocket,
  Send,
  User,
} from 'lucide-react';
import {
  castStudentIdeaVote,
  loginStudentWithCredentials,
  submitStudentIdea,
  submitSupportMessage,
  subscribePublicIdeas,
} from '../lib/clubStore';
import type {
  InboxMessageStatus,
  PublicIdea,
  StudentDashboardData,
  StudentSession,
} from '../types';
import { OrangeFlowBackground } from './OrangeFlowBackground';

interface IdeasPageProps {
  studentData: StudentDashboardData | null;
  studentSession: StudentSession | null;
  onStudentLoginSuccess: (session: StudentSession) => void;
  onBackToSite: () => void;
}

interface SupportPageProps {
  studentData: StudentDashboardData | null;
  onBackToSite: () => void;
}

const SUPPORT_TOPICS = [
  'Проблема со входом в кабинет',
  'Ошибка на сайте',
  'Вопрос по начислению баллов',
  'Другой вопрос',
] as const;

const IDEA_STATUS_LABELS: Record<InboxMessageStatus, { label: string; colorClass: string }> = {
  new: { label: 'На рассмотрении', colorClass: 'text-zinc-400' },
  accepted: { label: 'Принята, в разработке', colorClass: 'text-violet-400' },
  in_progress: { label: 'В работе', colorClass: 'text-amber-300' },
  done: { label: 'Реализовано', colorClass: 'text-emerald-400' },
};

function formatDateShortRu(iso: string): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '';
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'short',
  }).format(dt);
}

// ===========================================================================
// 1. /ides — All Club Ideas Board (1 student = 1 idea & 1 vote per idea)
// ===========================================================================
export function IdeasPage({
  studentData,
  studentSession,
  onStudentLoginSuccess,
  onBackToSite,
}: IdeasPageProps) {
  const [ideas, setIdeas] = useState<PublicIdea[]>([]);
  const [loadingIdeas, setLoadingIdeas] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | InboxMessageStatus>('all');
  const [votingId, setVotingId] = useState<string | null>(null);
  const [voteNotice, setVoteNotice] = useState<string | null>(null);

  // Inline student login state (when guest visits /ides)
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginSubmitting, setLoginSubmitting] = useState(false);

  // New idea submission form
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSubmitted, setJustSubmitted] = useState(false);

  useEffect(() => {
    setLoadingIdeas(true);
    const unsub = subscribePublicIdeas(
      studentSession?.studentId ?? null,
      (list) => {
        setIdeas(list);
        setLoadingIdeas(false);
      },
      () => {
        setLoadingIdeas(false);
      }
    );
    return () => unsub();
  }, [studentSession?.studentId]);

  const myExistingIdea = useMemo(() => {
    if (!studentSession) return null;
    return ideas.find((i) => i.studentId === studentSession.studentId) ?? null;
  }, [ideas, studentSession]);

  const filteredIdeas = useMemo(() => {
    if (statusFilter === 'all') return ideas;
    return ideas.filter((item) => item.status === statusFilter);
  }, [ideas, statusFilter]);

  async function handleInlineLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError(null);
    setLoginSubmitting(true);
    try {
      const session = await loginStudentWithCredentials(loginUsername, loginPassword);
      setLoginUsername('');
      setLoginPassword('');
      setVoteNotice(null);
      onStudentLoginSuccess(session);
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Неверный логин или пароль');
    } finally {
      setLoginSubmitting(false);
    }
  }

  async function handleVote(idea: PublicIdea, direction: 1 | -1) {
    setVoteNotice(null);
    if (!studentSession) {
      setVoteNotice(
        'Чтобы проголосовать (1 ученик — 1 голос), сначала войдите в аккаунт ученика слева.'
      );
      return;
    }
    if (idea.userVote !== 0) {
      setVoteNotice('Ваш голос за эту идею уже учтён (1 ученик может проголосовать 1 раз).');
      return;
    }
    if (votingId !== null) return;
    setVotingId(idea.id);
    try {
      await castStudentIdeaVote(studentSession, idea.id, direction);
    } catch (err) {
      setVoteNotice(
        err instanceof Error ? err.message : 'Не удалось учесть голос. Попробуйте ещё раз.'
      );
    } finally {
      setVotingId(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!studentSession) return;
    setError(null);
    setJustSubmitted(false);
    setSubmitting(true);
    try {
      const authorName = studentData?.student.fullName || studentSession.username;
      await submitStudentIdea(studentSession, authorName, subject, message);
      setSubject('');
      setMessage('');
      setJustSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить идею');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#070709] text-zinc-100 relative overflow-x-clip">
      <OrangeFlowBackground />

      <div className="relative z-10 max-w-[1200px] mx-auto px-6 py-8 space-y-8">
        {/* Top Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/90 pb-5">
          <div className="space-y-1">
            <button
              type="button"
              onClick={onBackToSite}
              className="inline-flex items-center gap-2 text-xs font-medium text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Вернуться на сайт Layf1x-TOP
            </button>
            <h1 className="font-display text-2xl md:text-3xl font-bold text-white flex items-center gap-2.5">
              <Lightbulb className="w-6 h-6 text-orange-400" />
              Идеи для Layf1x-TOP
            </h1>
            <p className="text-sm text-zinc-400">
              Голосуйте «За» или «Против» и предлагайте улучшения. Правило: 1 ученик — 1 идея и 1 голос за каждую идею.
            </p>
          </div>
          <div className="text-xs font-mono-num text-zinc-400 shrink-0">
            Всего идей: <span className="text-white font-semibold">{ideas.length}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Student Login Gate OR Submit Idea Form (1 student = 1 idea) */}
          <div className="lg:col-span-4 lg:sticky lg:top-8 bg-[#121216]/90 backdrop-blur-md border border-zinc-800 rounded-xl p-6 space-y-4">
            {!studentSession ? (
              <>
                <div className="space-y-1.5">
                  <div className="inline-flex items-center gap-1.5 text-xs font-medium text-orange-400">
                    <Lock className="w-3.5 h-3.5" />
                    <span>Вход для голосования и идей</span>
                  </div>
                  <h2 className="font-display text-base font-bold text-white">
                    Войдите как ученик
                  </h2>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Чтобы каждый ученик мог предложить идею и проголосовать ровно 1 раз (с компьютера или телефона), войдите по логину и паролю от тренера.
                  </p>
                </div>

                {loginError && (
                  <div className="p-3 bg-red-950/60 border border-red-900 rounded-lg text-xs text-red-300">
                    {loginError}
                  </div>
                )}

                <form onSubmit={handleInlineLogin} className="space-y-3.5">
                  <div className="space-y-1">
                    <label htmlFor="ides-login-user" className="block text-xs font-medium text-zinc-300">
                      Логин ученика
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        id="ides-login-user"
                        type="text"
                        required
                        autoComplete="username"
                        value={loginUsername}
                        onChange={(e) => setLoginUsername(e.target.value)}
                        placeholder="Например: artem_s"
                        className="w-full pl-9 pr-3 py-2 text-sm bg-[#09090B] text-white placeholder:text-zinc-600 border border-zinc-800 rounded-lg focus:outline-none focus:border-orange-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="ides-login-pass" className="block text-xs font-medium text-zinc-300">
                      Пароль
                    </label>
                    <input
                      id="ides-login-pass"
                      type="password"
                      required
                      autoComplete="current-password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Введите пароль"
                      className="w-full px-3 py-2 text-sm bg-[#09090B] text-white placeholder:text-zinc-600 border border-zinc-800 rounded-lg focus:outline-none focus:border-orange-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loginSubmitting}
                    className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-medium text-white bg-orange-600 hover:bg-orange-500 disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
                  >
                    <LogIn className="w-4 h-4" />
                    {loginSubmitting ? 'Вход...' : 'Войти и участвовать'}
                  </button>
                </form>
              </>
            ) : myExistingIdea ? (
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Вы уже предложили идею</span>
                </div>
                <h2 className="font-display text-base font-bold text-white">
                  {myExistingIdea.subject}
                </h2>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  В разделе идей действует правило: <strong className="text-zinc-200">1 ученик — 1 идея</strong>. Вы можете голосовать по 1 разу за любые идеи справа.
                </p>
                <div className="p-3 bg-[#09090B] border border-zinc-800 rounded-lg text-xs text-zinc-300 space-y-1">
                  <div className="text-zinc-500">Ваш статус:</div>
                  <div className={IDEA_STATUS_LABELS[myExistingIdea.status]?.colorClass ?? 'text-zinc-300'}>
                    {IDEA_STATUS_LABELS[myExistingIdea.status]?.label ?? 'На рассмотрении'}
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <div className="text-xs text-orange-400 font-medium mb-1">
                    Ученик: {studentData?.student.fullName ?? studentSession.username}
                  </div>
                  <h2 className="font-display text-base font-bold text-white">
                    Предложить свою идею
                  </h2>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Каждый ученик может предложить 1 идею. Она сразу появится в общем списке и у тренера.
                  </p>
                </div>

                {justSubmitted && (
                  <div className="p-3 bg-emerald-950/50 border border-emerald-800 rounded-lg text-xs text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Идея добавлена в список и отправлена тренеру!</span>
                  </div>
                )}

                {error && (
                  <div className="p-3 bg-red-950/60 border border-red-900 rounded-lg text-xs text-red-300">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-3.5">
                  <div className="space-y-1">
                    <label htmlFor="idea-subject" className="block text-xs font-medium text-zinc-300">
                      Название идеи
                    </label>
                    <input
                      id="idea-subject"
                      type="text"
                      required
                      maxLength={160}
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="Например: Задача дня с бонусными баллами"
                      className="w-full px-3 py-2 text-sm bg-[#09090B] text-white placeholder:text-zinc-600 border border-zinc-800 rounded-lg focus:outline-none focus:border-orange-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="idea-body" className="block text-xs font-medium text-zinc-300">
                      Описание
                    </label>
                    <textarea
                      id="idea-body"
                      rows={4}
                      required
                      maxLength={2000}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Расскажите, как это должно работать на сайте..."
                      className="w-full px-3 py-2 text-sm bg-[#09090B] text-white placeholder:text-zinc-600 border border-zinc-800 rounded-lg focus:outline-none focus:border-orange-500 resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-medium text-white bg-orange-600 hover:bg-orange-500 disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                    {submitting ? 'Отправка...' : 'Опубликовать идею'}
                  </button>
                </form>
              </>
            )}
          </div>

          {/* Right: Public Ideas List with Voting */}
          <div className="lg:col-span-8 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1 p-1 bg-[#121216]/90 border border-zinc-800 rounded-lg">
                {(
                  [
                    { id: 'all', label: 'Все идеи' },
                    { id: 'accepted', label: 'Принята, в разработке' },
                    { id: 'done', label: 'Реализовано' },
                    { id: 'new', label: 'Новые' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setStatusFilter(tab.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      statusFilter === tab.id
                        ? 'bg-orange-600 text-white'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="text-xs text-zinc-500">1 ученик — 1 голос</div>
            </div>

            {voteNotice && (
              <div className="p-3 bg-orange-950/40 border border-orange-800/70 rounded-lg text-xs text-orange-200">
                {voteNotice}
              </div>
            )}

            {loadingIdeas ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-28 bg-[#121216]/90 border border-zinc-800 rounded-xl animate-pulse"
                  />
                ))}
              </div>
            ) : filteredIdeas.length === 0 ? (
              <div className="bg-[#121216]/90 backdrop-blur-md border border-zinc-800 rounded-xl p-10 text-center space-y-2">
                <Lightbulb className="w-8 h-8 text-zinc-600 mx-auto" />
                <div className="text-sm text-zinc-300">
                  {statusFilter === 'all'
                    ? 'Идей пока нет — войдите как ученик и предложите первую!'
                    : 'В этой категории пока нет идей.'}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredIdeas.map((idea) => {
                  const statusMeta = IDEA_STATUS_LABELS[idea.status] ?? IDEA_STATUS_LABELS.new;
                  const alreadyVoted = idea.userVote !== 0;

                  return (
                    <article
                      key={idea.id}
                      className="bg-[#121216]/90 backdrop-blur-md border border-zinc-800 hover:border-zinc-700 rounded-xl p-5 flex items-start gap-4 transition-colors"
                    >
                      {/* Upvote / Downvote Controls (1 student = 1 vote) */}
                      <div className="w-16 shrink-0 flex flex-col gap-1.5">
                        <button
                          type="button"
                          disabled={votingId === idea.id || alreadyVoted}
                          onClick={() => handleVote(idea, 1)}
                          title={
                            alreadyVoted
                              ? 'Голос уже учтён (1 ученик — 1 голос)'
                              : 'Проголосовать ЗА'
                          }
                          aria-label="Проголосовать за идею"
                          className={`w-full py-1.5 px-2 rounded-lg border flex items-center justify-center gap-1 transition-colors ${
                            idea.userVote === 1
                              ? 'bg-orange-600/25 border-orange-500 text-orange-300'
                              : alreadyVoted
                                ? 'bg-[#09090B] border-zinc-800/70 text-zinc-600 opacity-60 cursor-not-allowed'
                                : 'bg-[#09090B] border-zinc-800 text-zinc-400 hover:border-orange-500/60 hover:text-orange-300 cursor-pointer'
                          }`}
                        >
                          <ChevronUp className="w-4 h-4 shrink-0" />
                          <span className="font-mono-num text-xs font-semibold">
                            {idea.upvotes}
                          </span>
                        </button>

                        <button
                          type="button"
                          disabled={votingId === idea.id || alreadyVoted}
                          onClick={() => handleVote(idea, -1)}
                          title={
                            alreadyVoted
                              ? 'Голос уже учтён (1 ученик — 1 голос)'
                              : 'Проголосовать ПРОТИВ'
                          }
                          aria-label="Проголосовать против идеи"
                          className={`w-full py-1.5 px-2 rounded-lg border flex items-center justify-center gap-1 transition-colors ${
                            idea.userVote === -1
                              ? 'bg-red-950/70 border-red-500/80 text-red-300'
                              : alreadyVoted
                                ? 'bg-[#09090B] border-zinc-800/70 text-zinc-600 opacity-60 cursor-not-allowed'
                                : 'bg-[#09090B] border-zinc-800 text-zinc-500 hover:border-red-500/60 hover:text-red-300 cursor-pointer'
                          }`}
                        >
                          <ChevronDown className="w-4 h-4 shrink-0" />
                          <span className="font-mono-num text-xs font-semibold">
                            {idea.downvotes}
                          </span>
                        </button>
                      </div>

                      {/* Idea Body */}
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span
                            className={`inline-flex items-center gap-1 font-medium ${statusMeta.colorClass}`}
                          >
                            {idea.status === 'accepted' && <Rocket className="w-3.5 h-3.5" />}
                            {statusMeta.label}
                          </span>
                          <span className="text-zinc-600">·</span>
                          <span className="text-zinc-400">{idea.authorName}</span>
                          {idea.createdAt && (
                            <>
                              <span className="text-zinc-600">·</span>
                              <span className="font-mono-num text-zinc-500">
                                {formatDateShortRu(idea.createdAt)}
                              </span>
                            </>
                          )}
                          {alreadyVoted && (
                            <>
                              <span className="text-zinc-600">·</span>
                              <span className="text-orange-400/90">
                                {idea.userVote === 1 ? 'Вы: ЗА' : 'Вы: ПРОТИВ'}
                              </span>
                            </>
                          )}
                        </div>

                        <h3 className="font-display text-base font-bold text-white">
                          {idea.subject}
                        </h3>

                        <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
                          {idea.message}
                        </p>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// 2. /Layf1x — Technical Support Page (Synced to Cloud Firestore)
// ===========================================================================
export function SupportPage({ studentData, onBackToSite }: SupportPageProps) {
  const [authorName, setAuthorName] = useState(studentData?.student.fullName ?? '');
  const [authorContact, setAuthorContact] = useState(
    studentData ? `логин: ${studentData.student.username}` : ''
  );
  const [subject, setSubject] = useState<string>(SUPPORT_TOPICS[0]);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const id = await submitSupportMessage(authorName, authorContact, subject, message);
      setSubmittedId(id);
      setMessage('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить обращение');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#070709] text-zinc-100 relative overflow-x-clip flex flex-col items-center justify-center p-6">
      <OrangeFlowBackground />

      <div className="relative z-10 w-full max-w-xl space-y-6">
        <button
          type="button"
          onClick={onBackToSite}
          className="inline-flex items-center gap-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Вернуться на сайт Layf1x-TOP
        </button>

        <div className="bg-[#121216]/90 backdrop-blur-md border border-zinc-800 rounded-xl p-7 md:p-8 space-y-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 text-xs font-medium text-orange-400">
              <LifeBuoy className="w-4 h-4" />
              <span>Layf1x-TOP · Техническая поддержка (/Layf1x)</span>
            </div>
            <h1 className="font-display text-2xl font-bold text-white">
              Техподдержка Layf1x-TOP
            </h1>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Если возникла проблема со входом, баллами или работой сайта — напишите сюда. Сообщение сразу поступит администратору в панель управления.
            </p>
          </div>

          {submittedId !== null ? (
            <div className="p-6 bg-orange-950/35 border border-orange-800/70 rounded-xl space-y-4 text-center">
              <CheckCircle2 className="w-10 h-10 text-orange-400 mx-auto" />
              <div className="space-y-1">
                <div className="font-display text-lg font-bold text-white">
                  Обращение принято
                </div>
                <p className="text-xs text-zinc-300">
                  Администратор сразу увидит ваше сообщение в панели управления и поможет решить вопрос.
                </p>
              </div>
              <div className="flex items-center justify-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setSubmittedId(null)}
                  className="px-4 py-2 text-xs font-medium text-white bg-orange-600 hover:bg-orange-500 rounded-lg cursor-pointer"
                >
                  Написать ещё
                </button>
                <button
                  type="button"
                  onClick={onBackToSite}
                  className="px-4 py-2 text-xs font-medium text-zinc-300 hover:text-white border border-zinc-700 rounded-lg cursor-pointer"
                >
                  На главную
                </button>
              </div>
            </div>
          ) : (
            <>
              {error && (
                <div className="p-3 bg-red-950/60 border border-red-900 rounded-lg text-xs text-red-300">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="support-name" className="block text-xs font-medium text-zinc-300">
                      Ваше имя
                    </label>
                    <input
                      id="support-name"
                      type="text"
                      required
                      maxLength={100}
                      value={authorName}
                      onChange={(e) => setAuthorName(e.target.value)}
                      placeholder="Как к вам обращаться"
                      className="w-full px-3 py-2.5 text-sm bg-[#09090B] text-white placeholder:text-zinc-600 border border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="support-contact" className="block text-xs font-medium text-zinc-300">
                      Логин или контакт для связи
                    </label>
                    <input
                      id="support-contact"
                      type="text"
                      maxLength={120}
                      value={authorContact}
                      onChange={(e) => setAuthorContact(e.target.value)}
                      placeholder="Telegram, телефон или логин"
                      className="w-full px-3 py-2.5 text-sm bg-[#09090B] text-white placeholder:text-zinc-600 border border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="support-topic" className="block text-xs font-medium text-zinc-300">
                    Тема обращения
                  </label>
                  <select
                    id="support-topic"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm bg-[#09090B] text-white border border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
                  >
                    {SUPPORT_TOPICS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="support-body" className="block text-xs font-medium text-zinc-300">
                    Опишите проблему
                  </label>
                  <textarea
                    id="support-body"
                    rows={4}
                    required
                    maxLength={2000}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Что именно не работает или какая нужна помощь..."
                    className="w-full px-3 py-2.5 text-sm bg-[#09090B] text-white placeholder:text-zinc-600 border border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-medium text-white bg-orange-600 hover:bg-orange-500 disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  {submitting ? 'Отправка...' : 'Отправить в техподдержку'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
