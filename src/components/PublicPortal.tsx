import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Award,
  BookOpen,
  Download,
  LogIn,
  LogOut,
  Megaphone,
  Paperclip,
  Search,
  Sparkles,
  Trophy,
  User,
  X,
} from 'lucide-react';
import { downloadNewsFile, loginStudentWithCredentials } from '../lib/clubStore';
import {
  CHESS_RANKS,
  formatDateRu,
  formatFileSize,
  formatNumber,
  getChessRank,
  type NewsItem,
  type PublicOverviewResponse,
  type StudentDashboardData,
  type StudentSession,
} from '../types';
import { OrangeFlowBackground } from './OrangeFlowBackground';
import { StudentAiSection } from './StudentAiSection';

const HERO_IMAGE_URL = '/src/assets/images/chess_club_hero_1795694114063.jpg';

interface PublicPortalProps {
  overview: PublicOverviewResponse | null;
  loading: boolean;
  error: string | null;
  studentSession: StudentSession | null;
  studentData: StudentDashboardData | null;
  onStudentLoginSuccess: (session: StudentSession) => void;
  onStudentLogout: () => void;
  onNavigatePath?: (path: string) => void;
}

export function PublicPortal({
  overview,
  loading,
  error,
  studentSession,
  studentData,
  onStudentLoginSuccess,
  onStudentLogout,
  onNavigatePath,
}: PublicPortalProps) {
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [heroImgFailed, setHeroImgFailed] = useState(false);

  const [loginOpen, setLoginOpen] = useState(false);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginSubmitting, setLoginSubmitting] = useState(false);

  const [activeNewsModal, setActiveNewsModal] = useState<NewsItem | null>(null);
  const [downloadingNewsId, setDownloadingNewsId] = useState<string | null>(null);
  const [cabinetTab, setCabinetTab] = useState<'progress' | 'ai'>('progress');

  const filteredStudents = useMemo(() => {
    if (!overview) return [];
    const q = searchQuery.trim().toLowerCase();
    return overview.students.filter((s) => {
      if (selectedGroup !== 'all' && s.groupName !== selectedGroup) return false;
      if (q && !s.fullName.toLowerCase().includes(q) && !s.groupName.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [overview, selectedGroup, searchQuery]);

  async function handleLoginSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoginError(null);
    setLoginSubmitting(true);
    try {
      const session = await loginStudentWithCredentials(loginUsername, loginPassword);
      setLoginUsername('');
      setLoginPassword('');
      setLoginOpen(false);
      onStudentLoginSuccess(session);
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Не удалось войти');
    } finally {
      setLoginSubmitting(false);
    }
  }

  async function handleDownloadFile(item: NewsItem) {
    if (!item.fileName || downloadingNewsId) return;
    setDownloadingNewsId(item.id);
    try {
      await downloadNewsFile(item.id, item.fileName);
    } catch {
      // ignore
    } finally {
      setDownloadingNewsId(null);
    }
  }

  const studentRankInfo = studentData ? getChessRank(studentData.student.totalPoints) : null;
  const studentProgressPct = useMemo(() => {
    if (!studentData || !studentRankInfo) return 0;
    if (studentRankInfo.nextPoints === null) return 100;
    const span = studentRankInfo.nextPoints - studentRankInfo.minPoints;
    if (span <= 0) return 100;
    const gained = Math.max(0, studentData.student.totalPoints - studentRankInfo.minPoints);
    return Math.min(100, Math.round((gained / span) * 100));
  }, [studentData, studentRankInfo]);

  // Maintenance Mode Screen (zero admin button exposed)
  if (!loading && overview?.maintenance?.enabled) {
    return (
      <div className="min-h-screen relative text-zinc-100 flex items-center justify-center p-6 overflow-hidden">
        <OrangeFlowBackground />
        <div className="relative z-10 w-full max-w-lg bg-[#101014]/90 backdrop-blur-md border border-zinc-800 rounded-2xl p-8 md:p-10 text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-7 h-7 text-orange-400" />
          </div>
          <div className="text-xs font-medium text-orange-400">Шахматный клуб Layf1x-TOP</div>
          <h1
            className="font-display text-2xl md:text-3xl font-bold text-white"
            style={{ textWrap: 'balance' }}
          >
            {overview.maintenance.title || 'Технические работы'}
          </h1>
          <p className="text-sm md:text-base text-zinc-400 leading-relaxed">
            {overview.maintenance.message || 'Мы обновляем платформу. Пожалуйста, зайдите чуть позже.'}
          </p>
          {overview.maintenance.until && (
            <div className="pt-2 text-xs font-mono-num text-zinc-300">
              Ориентировочное возвращение: {overview.maintenance.until}
            </div>
          )}
        </div>
      </div>
    );
  }

  const marqueeNews = overview?.news ?? [];

  return (
    <div className="min-h-screen relative text-zinc-100 flex flex-col">
      <OrangeFlowBackground />

      {/* Top Bar Contract: strictly 3 zones separated by gap-8, NO admin button */}
      <header className="sticky top-0 z-30 bg-[#09090B]/85 backdrop-blur-md border-b border-zinc-800/90">
        <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <a
            href="#top"
            className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0"
          >
            Layf1x-TOP
          </a>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-zinc-400">
            <a
              href="#rating"
              className="hover:text-orange-400 transition-colors whitespace-nowrap shrink-0"
            >
              Рейтинг
            </a>
            <a
              href="#ranks"
              className="hover:text-orange-400 transition-colors whitespace-nowrap shrink-0"
            >
              Разряды
            </a>
            <a
              href="#journal"
              className="hover:text-orange-400 transition-colors whitespace-nowrap shrink-0"
            >
              Журнал
            </a>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            {studentSession && studentData ? (
              <button
                type="button"
                onClick={onStudentLogout}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-200 bg-zinc-900/90 border border-zinc-700 hover:bg-zinc-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                Выйти
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setLoginOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-orange-600 hover:bg-orange-500 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                Кабинет ученика
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Running News Ticker / Marquee with clickable news & downloadable files */}
      {marqueeNews.length > 0 && (
        <div className="relative z-20 bg-[#121216]/90 backdrop-blur-md border-b border-orange-500/25 overflow-hidden marquee-wrapper">
          <div className="max-w-[1440px] mx-auto flex items-center">
            <div className="hidden sm:flex items-center gap-2 px-5 py-2.5 bg-orange-600/15 border-r border-orange-500/25 text-xs font-semibold text-orange-400 whitespace-nowrap shrink-0">
              <Megaphone className="w-3.5 h-3.5" />
              <span>Новости</span>
            </div>

            <div className="flex-1 overflow-hidden py-2.5">
              <div className="marquee-track">
                {[0, 1].map((dup) => (
                  <div key={dup} className="flex items-center shrink-0">
                    {marqueeNews.map((item) => (
                      <div
                        key={`${dup}-${item.id}`}
                        className="inline-flex items-center gap-3 px-6 text-xs text-zinc-200 whitespace-nowrap shrink-0"
                      >
                        <button
                          type="button"
                          onClick={() => setActiveNewsModal(item)}
                          className="inline-flex items-center gap-2 hover:text-orange-400 transition-colors cursor-pointer"
                        >
                          <span className="font-medium">{item.title}</span>
                          {item.fileName && (
                            <span className="inline-flex items-center gap-1 text-orange-400 font-medium">
                              <Paperclip className="w-3 h-3" />
                              {item.fileName}
                            </span>
                          )}
                        </button>
                        <span aria-hidden="true" className="text-zinc-600">
                          ·
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <main
        id="top"
        className="relative z-10 flex-1 max-w-[1200px] w-full mx-auto px-6 py-10 space-y-12"
      >
        {/* Logged-in Student Personal Cabinet */}
        {studentSession && studentData && studentRankInfo && (
          <section className="bg-[#101014]/85 backdrop-blur-md border border-zinc-800 rounded-xl p-6 md:p-8 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
              <div className="space-y-1">
                <div className="text-xs font-medium text-zinc-400">
                  Личный кабинет ученика · {studentData.student.groupName} · логин{' '}
                  {studentData.student.username}
                </div>
                <h2 className="font-display text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
                  <span aria-hidden="true" className="text-orange-400">
                    {studentData.student.pieceSymbol}
                  </span>
                  {studentData.student.fullName}
                </h2>
              </div>

              <div className="flex items-center gap-8 text-right">
                <div>
                  <div className="text-xs text-zinc-400">Место в клубе</div>
                  <div className="font-mono-num text-2xl font-semibold text-white">
                    {studentData.student.clubRank}
                    <span className="text-sm font-normal text-zinc-500">
                      /{studentData.student.totalStudents}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-zinc-400">Всего баллов</div>
                  <div className="font-mono-num text-2xl font-semibold text-orange-400">
                    {formatNumber(studentData.student.totalPoints)}
                  </div>
                </div>
              </div>
            </div>

            {/* Coach-controlled Student Cabinet Sections */}
            {studentData.student.aiEnabled && (
              <div className="flex items-center gap-2 border-b border-zinc-800 pb-4">
                <button
                  type="button"
                  onClick={() => setCabinetTab('progress')}
                  className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    cabinetTab === 'progress'
                      ? 'bg-orange-600 text-white'
                      : 'bg-[#09090B] text-zinc-400 border border-zinc-800 hover:text-white'
                  }`}
                >
                  <Award className="w-3.5 h-3.5" />
                  Мой прогресс и баллы
                </button>
                <button
                  type="button"
                  onClick={() => setCabinetTab('ai')}
                  className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    cabinetTab === 'ai'
                      ? 'bg-orange-600 text-white'
                      : 'bg-[#09090B] text-zinc-400 border border-zinc-800 hover:text-white'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Шахматный помощник
                </button>
              </div>
            )}

            {studentData.student.aiEnabled && cabinetTab === 'ai' ? (
              <StudentAiSection
                studentSession={studentSession}
                studentName={studentData.student.fullName}
                groupName={studentData.student.groupName}
                totalPoints={studentData.student.totalPoints}
              />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-4">
                  <div>
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="font-medium text-zinc-100">
                        Звание: {studentRankInfo.symbol} {studentRankInfo.title}
                      </span>
                      <span className="font-mono-num text-xs text-zinc-400">
                        {studentRankInfo.nextPoints !== null
                          ? `${formatNumber(studentData.student.totalPoints)} / ${formatNumber(studentRankInfo.nextPoints)}`
                          : 'Высший разряд'}
                      </span>
                    </div>
                    <div className="mt-2 h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-orange-500 rounded-full transition-all duration-300"
                        style={{ width: `${studentProgressPct}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-zinc-400">
                      {studentRankInfo.nextPoints !== null && studentRankInfo.nextTitle
                        ? `До звания «${studentRankInfo.nextTitle}» осталось ${formatNumber(
                            Math.max(0, studentRankInfo.nextPoints - studentData.student.totalPoints)
                          )} баллов.`
                        : 'Достигнуто высшее клубное звание «Гроссмейстер».'}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-zinc-800 space-y-2.5">
                    <div className="text-xs font-medium text-zinc-400">Баллы по направлениям</div>
                    {studentData.categoryTotals.length === 0 ? (
                      <p className="text-sm text-zinc-500">Пока нет начисленных баллов.</p>
                    ) : (
                      <div className="space-y-2">
                        {studentData.categoryTotals.map((cat) => (
                          <div key={cat.category} className="flex items-center justify-between text-sm">
                            <span className="text-zinc-300">
                              {cat.category}
                              <span className="text-zinc-500"> · {cat.count}</span>
                            </span>
                            <span
                              className={`font-mono-num font-medium ${
                                cat.points >= 0 ? 'text-emerald-400' : 'text-red-400'
                              }`}
                            >
                              {cat.points > 0
                                ? `+${formatNumber(cat.points)}`
                                : formatNumber(cat.points)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="lg:col-span-2">
                  <div className="text-xs font-medium text-zinc-400 mb-3">
                    История моих начислений
                  </div>
                  {studentData.history.length === 0 ? (
                    <div className="py-10 text-center border border-zinc-800 rounded-lg text-sm text-zinc-500">
                      Тренер ещё не вносил баллы по вашему аккаунту.
                    </div>
                  ) : (
                    <div className="border border-zinc-800 rounded-lg overflow-hidden">
                      <div className="max-h-72 overflow-y-auto">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-[#18181D] border-b border-zinc-800 text-xs text-zinc-400">
                            <tr>
                              <th className="py-2.5 px-4 font-medium">Дата</th>
                              <th className="py-2.5 px-4 font-medium">Причина и категория</th>
                              <th className="py-2.5 px-4 font-medium text-right">Баллы</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-800/70">
                            {studentData.history.map((item) => (
                              <tr key={item.id} className="hover:bg-zinc-900/60">
                                <td className="py-2.5 px-4 text-xs text-zinc-400 whitespace-nowrap font-mono-num">
                                  {formatDateRu(item.eventDate)}
                                </td>
                                <td className="py-2.5 px-4">
                                  <div className="text-zinc-100 font-medium">{item.reason}</div>
                                  <div className="text-xs text-zinc-500">{item.category}</div>
                                </td>
                                <td
                                  className={`py-2.5 px-4 text-right font-mono-num font-semibold whitespace-nowrap ${
                                    item.delta >= 0 ? 'text-emerald-400' : 'text-red-400'
                                  }`}
                                >
                                  {item.delta > 0
                                    ? `+${formatNumber(item.delta)}`
                                    : formatNumber(item.delta)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Balanced 2-Column Hero Split */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          <div className="lg:col-span-7 bg-[#101014]/85 backdrop-blur-md border border-zinc-800 rounded-xl p-8 md:p-10 flex flex-col justify-between gap-8">
            <div className="space-y-4">
              <div className="text-xs font-medium text-orange-400">
                Шахматный клуб Layf1x-TOP · Открытый рейтинг и личные кабинеты
              </div>
              <h1
                className="font-display text-3xl md:text-4xl font-bold tracking-tight text-white leading-tight"
                style={{ textWrap: 'balance' }}
              >
                Учёт баллов учеников и путь к шахматным разрядам
              </h1>
              <p className="text-base text-zinc-400 leading-relaxed max-w-xl">
                Следите за турнирной таблицей, начислениями за тактику, партии и домашние задания.
                Ученики входят по логину и паролю, выданному тренером, без привязки к Google.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              {!studentSession && (
                <button
                  type="button"
                  onClick={() => setLoginOpen(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-orange-600 hover:bg-orange-500 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Войти ученику
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
              <a
                href="#rating"
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-zinc-200 hover:text-white border border-zinc-700 hover:border-orange-500/60 bg-zinc-900/70 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Перейти к таблице
              </a>
            </div>
          </div>

          <div className="lg:col-span-5 relative rounded-xl overflow-hidden border border-zinc-800 min-h-[260px] bg-zinc-950">
            {!heroImgFailed ? (
              <img
                src={HERO_IMAGE_URL}
                alt="Классические деревянные шахматы Стаунтон на турнирной доске"
                referrerPolicy="no-referrer"
                onError={() => setHeroImgFailed(true)}
                className="w-full h-full lg:h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-gradient-to-br from-zinc-900 to-black text-white">
                <Trophy className="w-10 h-10 text-orange-400 mb-3" />
                <div className="font-display text-lg font-semibold">Layf1x-TOP</div>
                <div className="text-xs text-zinc-400 mt-1">Рейтинг, турниры и прогресс учеников</div>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent flex items-end p-6">
              <div className="text-white space-y-1">
                <div className="text-xs text-orange-300">Текущий лидер Layf1x-TOP</div>
                <div className="font-display text-xl font-bold">
                  {overview && overview.students.length > 0
                    ? `${overview.students[0].fullName} — ${formatNumber(overview.students[0].totalPoints)} б.`
                    : 'Сезон открыт'}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Full-Width 4-Column KPI Strip */}
        <section className="grid grid-cols-2 lg:grid-cols-4 bg-[#101014]/85 backdrop-blur-md border border-zinc-800 rounded-xl divide-y lg:divide-y-0 lg:divide-x divide-zinc-800">
          <div className="p-6">
            <div className="text-xs text-zinc-400">Активных учеников</div>
            <div className="mt-2 font-mono-num text-2xl font-semibold text-white">
              {loading ? '—' : formatNumber(overview?.stats.totalStudents ?? 0)}
            </div>
          </div>
          <div className="p-6">
            <div className="text-xs text-zinc-400">Всего заработано баллов</div>
            <div className="mt-2 font-mono-num text-2xl font-semibold text-white">
              {loading ? '—' : formatNumber(overview?.stats.totalPoints ?? 0)}
            </div>
          </div>
          <div className="p-6">
            <div className="text-xs text-zinc-400">Начислений в этом месяце</div>
            <div className="mt-2 font-mono-num text-2xl font-semibold text-white">
              {loading ? '—' : formatNumber(overview?.stats.eventsThisMonth ?? 0)}
            </div>
          </div>
          <div className="p-6">
            <div className="text-xs text-zinc-400">Рекорд клуба</div>
            <div className="mt-2 font-mono-num text-2xl font-semibold text-orange-400">
              {loading ? '—' : `${formatNumber(overview?.stats.topScore ?? 0)} б.`}
            </div>
          </div>
        </section>

        {/* Main Student Leaderboard */}
        <section id="rating" className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl font-bold text-white">
                Турнирная таблица баллов
              </h2>
              <p className="text-sm text-zinc-400 mt-1">
                Обновляется мгновенно после каждого урока, решённой задачи и партии.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Поиск ученика..."
                  className="w-full sm:w-56 pl-9 pr-3 py-2 text-sm bg-[#101014]/90 text-white placeholder:text-zinc-500 border border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
                />
              </div>

              {overview && overview.groups.length > 0 && (
                <div className="flex items-center gap-1 p-1 bg-[#101014]/90 border border-zinc-800 rounded-lg overflow-x-auto">
                  <button
                    type="button"
                    onClick={() => setSelectedGroup('all')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      selectedGroup === 'all'
                        ? 'bg-orange-600 text-white'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Все группы
                  </button>
                  {overview.groups.map((grp) => (
                    <button
                      key={grp}
                      type="button"
                      onClick={() => setSelectedGroup(grp)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        selectedGroup === grp
                          ? 'bg-orange-600 text-white'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      {grp}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-950/60 border border-red-900 rounded-lg text-sm text-red-300">
              {error}
            </div>
          )}

          <div className="bg-[#101014]/85 backdrop-blur-md border border-zinc-800 rounded-xl overflow-hidden">
            {loading ? (
              <div className="divide-y divide-zinc-800">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="h-14 px-6 flex items-center justify-between animate-pulse"
                  >
                    <div className="h-4 w-48 bg-zinc-800 rounded" />
                    <div className="h-4 w-20 bg-zinc-800 rounded" />
                  </div>
                ))}
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="py-12 px-6 text-center text-sm text-zinc-500">
                Ученики по заданному фильтру не найдены.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#18181D]/90 border-b border-zinc-800 text-xs text-zinc-400">
                    <tr>
                      <th className="py-3 px-6 font-medium w-16">Место</th>
                      <th className="py-3 px-6 font-medium">Ученик</th>
                      <th className="py-3 px-6 font-medium">Группа и звание</th>
                      <th className="py-3 px-6 font-medium text-right">За месяц</th>
                      <th className="py-3 px-6 font-medium text-right">Событий</th>
                      <th className="py-3 px-6 font-medium text-right">Всего баллов</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/70">
                    {filteredStudents.map((s) => {
                      const rankInfo = getChessRank(s.totalPoints);
                      const isCurrent = studentData?.student.id === s.id;
                      return (
                        <tr
                          key={s.id}
                          className={`transition-colors ${
                            isCurrent ? 'bg-orange-950/35' : 'hover:bg-zinc-900/60'
                          }`}
                        >
                          <td className="py-3.5 px-6 font-mono-num font-semibold text-zinc-300">
                            {s.rank === 1 ? (
                              <span className="text-orange-400">1</span>
                            ) : (
                              s.rank
                            )}
                          </td>
                          <td className="py-3.5 px-6">
                            <div className="font-medium text-white flex items-center gap-2.5">
                              <span aria-hidden="true" className="text-base text-zinc-300">
                                {s.pieceSymbol}
                              </span>
                              <span>{s.fullName}</span>
                              {isCurrent && (
                                <span className="text-xs font-medium text-orange-400">· это вы</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-6 text-xs text-zinc-400">
                            <span>{s.groupName}</span>
                            <span aria-hidden="true" className="mx-1.5">
                              ·
                            </span>
                            <span className="text-zinc-200 font-medium">{rankInfo.title}</span>
                          </td>
                          <td
                            className={`py-3.5 px-6 text-right font-mono-num text-xs font-medium ${
                              s.monthDelta > 0
                                ? 'text-emerald-400'
                                : s.monthDelta < 0
                                  ? 'text-red-400'
                                  : 'text-zinc-500'
                            }`}
                          >
                            {s.monthDelta > 0
                              ? `+${formatNumber(s.monthDelta)}`
                              : formatNumber(s.monthDelta)}
                          </td>
                          <td className="py-3.5 px-6 text-right font-mono-num text-xs text-zinc-400">
                            {formatNumber(s.eventsCount)}
                          </td>
                          <td className="py-3.5 px-6 text-right font-mono-num font-semibold text-white">
                            {formatNumber(s.totalPoints)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* Chess Rank System */}
        <section id="ranks" className="space-y-4">
          <div>
            <h2 className="font-display text-2xl font-bold text-white">
              Система шахматных званий
            </h2>
            <p className="text-sm text-zinc-400 mt-1">
              Звание присваивается автоматически по сумме набранных баллов.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 bg-[#101014]/85 backdrop-blur-md border border-zinc-800 rounded-xl divide-y md:divide-y-0 md:divide-x divide-zinc-800">
            {CHESS_RANKS.map((rank) => (
              <div key={rank.title} className="p-5 flex flex-col justify-between gap-3">
                <div className="text-2xl text-orange-400/90" aria-hidden="true">
                  {rank.symbol}
                </div>
                <div>
                  <div className="font-display font-semibold text-white">{rank.title}</div>
                  <div className="font-mono-num text-xs text-zinc-400 mt-0.5">
                    от {formatNumber(rank.minPoints)} б.
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Recent Points Journal */}
        <section id="journal" className="space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl font-bold text-white">
                Последние начисления
              </h2>
              <p className="text-sm text-zinc-400 mt-1">
                Свежие турнирные победы, решённые задачи и успехи на занятиях.
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-xs text-zinc-500">
              <BookOpen className="w-4 h-4" />
              <span>Показано до 25 последних записей</span>
            </div>
          </div>

          <div className="bg-[#101014]/85 backdrop-blur-md border border-zinc-800 rounded-xl overflow-hidden">
            {!overview || overview.recentEvents.length === 0 ? (
              <div className="py-12 px-6 text-center text-sm text-zinc-500">
                Записей о начислении баллов пока нет.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#18181D]/90 border-b border-zinc-800 text-xs text-zinc-400">
                    <tr>
                      <th className="py-3 px-6 font-medium">Дата</th>
                      <th className="py-3 px-6 font-medium">Ученик</th>
                      <th className="py-3 px-6 font-medium">Причина</th>
                      <th className="py-3 px-6 font-medium text-right">Баллы</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/70">
                    {overview.recentEvents.map((ev) => (
                      <tr key={ev.id} className="hover:bg-zinc-900/60">
                        <td className="py-3 px-6 font-mono-num text-xs text-zinc-400 whitespace-nowrap">
                          {formatDateRu(ev.eventDate)}
                        </td>
                        <td className="py-3 px-6">
                          <div className="font-medium text-white">{ev.studentName}</div>
                          <div className="text-xs text-zinc-500">{ev.groupName}</div>
                        </td>
                        <td className="py-3 px-6">
                          <div className="text-zinc-200">{ev.reason}</div>
                          <div className="text-xs text-zinc-500">{ev.category}</div>
                        </td>
                        <td
                          className={`py-3 px-6 text-right font-mono-num font-semibold whitespace-nowrap ${
                            ev.delta >= 0 ? 'text-emerald-400' : 'text-red-400'
                          }`}
                        >
                          {ev.delta > 0 ? `+${formatNumber(ev.delta)}` : formatNumber(ev.delta)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Footer — NO admin panel link */}
      <footer className="relative z-10 mt-12 border-t border-zinc-800/90 bg-[#09090B]/85 backdrop-blur-md">
        <div className="max-w-[1200px] mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
          <div>© {new Date().getFullYear()} Layf1x-TOP · Учёт баллов учеников по шахматам</div>
          <div className="flex flex-wrap items-center gap-6">
            <button
              type="button"
              onClick={() => onNavigatePath?.('/ides')}
              className="hover:text-orange-400 transition-colors cursor-pointer"
            >
              Предложить идею (/ides)
            </button>
            <button
              type="button"
              onClick={() => onNavigatePath?.('/Layf1x')}
              className="hover:text-orange-400 transition-colors cursor-pointer"
            >
              Техподдержка (/Layf1x)
            </button>
            <button
              type="button"
              onClick={() => setLoginOpen(true)}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Вход для учеников
            </button>
          </div>
        </div>
      </footer>

      {/* News Detail & File Attachment Modal */}
      {activeNewsModal && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-[2px] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-[#121216] border border-zinc-800 rounded-xl w-full max-w-lg p-6 space-y-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="text-xs font-medium text-orange-400">
                  Новость клуба Layf1x-TOP
                </div>
                <h3 className="font-display text-lg font-bold text-white">
                  {activeNewsModal.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveNewsModal(null)}
                aria-label="Закрыть"
                className="p-1.5 text-zinc-500 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {activeNewsModal.body && (
              <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-line">
                {activeNewsModal.body}
              </p>
            )}

            {activeNewsModal.fileName && activeNewsModal.hasFile && (
              <div className="p-4 bg-[#09090B] border border-zinc-800 rounded-lg flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-xs text-zinc-400">Прикреплённый файл</div>
                  <div className="text-sm font-medium text-white truncate mt-0.5">
                    {activeNewsModal.fileName}
                  </div>
                  {activeNewsModal.fileSize && (
                    <div className="text-xs font-mono-num text-zinc-500 mt-0.5">
                      {formatFileSize(activeNewsModal.fileSize)}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  disabled={downloadingNewsId === activeNewsModal.id}
                  onClick={() => handleDownloadFile(activeNewsModal)}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-orange-600 hover:bg-orange-500 disabled:opacity-60 rounded-lg whitespace-nowrap shrink-0 transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  {downloadingNewsId === activeNewsModal.id ? 'Загрузка...' : 'Скачать'}
                </button>
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setActiveNewsModal(null)}
                className="px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white cursor-pointer"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Student Login Modal (No Google OAuth) */}
      {loginOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-[2px] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="student-login-title"
        >
          <div className="bg-[#121216] border border-zinc-800 rounded-xl w-full max-w-md p-6 space-y-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 id="student-login-title" className="font-display text-xl font-bold text-white">
                  Вход в кабинет ученика
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Используйте логин и пароль, выданные тренером Layf1x-TOP.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLoginOpen(false)}
                aria-label="Закрыть"
                className="p-1.5 text-zinc-500 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loginError && (
              <div className="p-3 bg-red-950/60 border border-red-900 rounded-lg text-xs text-red-300">
                {loginError}
              </div>
            )}

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="student-username" className="block text-xs font-medium text-zinc-300">
                  Логин ученика
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="student-username"
                    type="text"
                    required
                    autoComplete="username"
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    placeholder="Например: artem_s"
                    className="w-full pl-9 pr-3 py-2.5 text-sm bg-[#09090B] text-white placeholder:text-zinc-600 border border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="student-password" className="block text-xs font-medium text-zinc-300">
                  Пароль
                </label>
                <input
                  id="student-password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Введите пароль"
                  className="w-full px-3 py-2.5 text-sm bg-[#09090B] text-white placeholder:text-zinc-600 border border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
                />
              </div>

              <button
                type="submit"
                disabled={loginSubmitting}
                className="w-full py-2.5 px-4 text-sm font-medium text-white bg-orange-600 hover:bg-orange-500 disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
              >
                {loginSubmitting ? 'Вход...' : 'Войти в кабинет'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
