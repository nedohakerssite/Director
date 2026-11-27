import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Award,
  Inbox,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  Paperclip,
  Plus,
  Snowflake,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import {
  DEFAULT_SITE_CONFIG,
  saveSiteConfig,
  subscribeAdminInbox,
  subscribeAdminNews,
  subscribeAdminStudents,
  subscribePointEvents,
  subscribeSiteConfig,
} from '../lib/clubStore';
import {
  formatDateRu,
  formatNumber,
  type AdminStudent,
  type InboxMessage,
  type NewsItem,
  type PublicPointEvent,
  type SiteConfig,
} from '../types';
import { AdminMessagesView } from './AdminMessagesView';
import { AdminMaintenanceView, AdminNewsView } from './AdminNewsAndMaintenance';
import { AdminPointsView, AdminStudentsView } from './AdminStudentsAndPoints';
import { OrangeFlowBackground } from './OrangeFlowBackground';

type AdminTab = 'overview' | 'points' | 'students' | 'messages' | 'news' | 'maintenance';

interface AdminPanelProps {
  adminEmail: string;
  onLogout: () => void;
  onBackToSite: () => void;
}

const NAV_ITEMS: Array<{
  id: AdminTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'overview', label: 'Обзор', icon: LayoutDashboard },
  { id: 'points', label: 'Баллы учеников', icon: Award },
  { id: 'students', label: 'Аккаунты учеников', icon: Users },
  { id: 'messages', label: 'Идеи и поддержка', icon: Inbox },
  { id: 'news', label: 'Бегущая строка', icon: Megaphone },
  { id: 'maintenance', label: 'Техработы и снег', icon: Wrench },
];

export function AdminPanel({ adminEmail, onLogout, onBackToSite }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [students, setStudents] = useState<AdminStudent[]>([]);
  const [pointEvents, setPointEvents] = useState<PublicPointEvent[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [inboxMessages, setInboxMessages] = useState<InboxMessage[]>([]);
  const [siteConfig, setSiteConfig] = useState<SiteConfig>(DEFAULT_SITE_CONFIG);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingSnow, setTogglingSnow] = useState(false);

  useEffect(() => {
    setError(null);
    let loadedStudents = false;
    let loadedConfig = false;
    const maybeDone = () => {
      if (loadedStudents && loadedConfig) setLoading(false);
    };

    const onErr = (err: unknown) => {
      setError(err instanceof Error ? err.message : 'Ошибка синхронизации с базой данных');
      setLoading(false);
    };

    const unsubConfig = subscribeSiteConfig((cfg) => {
      setSiteConfig(cfg);
      loadedConfig = true;
      maybeDone();
    }, onErr);

    const unsubStudents = subscribeAdminStudents((list) => {
      setStudents(list);
      loadedStudents = true;
      maybeDone();
    }, onErr);

    const unsubPoints = subscribePointEvents(true, setPointEvents, onErr);
    const unsubNews = subscribeAdminNews(setNews, onErr);
    const unsubInbox = subscribeAdminInbox(setInboxMessages, onErr);

    return () => {
      unsubConfig();
      unsubStudents();
      unsubPoints();
      unsubNews();
      unsubInbox();
    };
  }, []);

  async function handleQuickSnowToggle() {
    setTogglingSnow(true);
    try {
      await saveSiteConfig({
        ...siteConfig,
        snowEnabled: !siteConfig.snowEnabled,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось переключить снег');
    } finally {
      setTogglingSnow(false);
    }
  }

  const currentNav = NAV_ITEMS.find((n) => n.id === activeTab)!;
  const activeStudentsCount = students.filter((s) => s.active).length;
  const totalClubPoints = students.reduce((acc, s) => acc + s.totalPoints, 0);
  const activeNewsCount = news.filter((n) => n.active).length;
  const filesCount = news.filter((n) => Boolean(n.fileName)).length;
  const unreadMessagesCount = inboxMessages.filter((m) => m.status === 'new').length;

  return (
    <div className="min-h-screen bg-[#070709] text-zinc-100 relative overflow-x-clip">
      <OrangeFlowBackground />

      <div className="relative z-10 min-h-screen flex">
        {/* Desktop Sidebar (248px) */}
        <aside className="hidden lg:flex w-[248px] shrink-0 bg-[#101014]/90 backdrop-blur-md border-r border-zinc-800/90 flex-col justify-between sticky top-0 h-screen">
          <div className="p-5 space-y-6">
            <div className="px-2">
              <div className="font-display text-base font-bold text-white">Layf1x-TOP</div>
              <div className="text-xs text-zinc-400 mt-0.5 truncate" title={adminEmail}>
                Админ · {adminEmail}
              </div>
            </div>

            <nav className="space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                      active
                        ? 'bg-orange-600 text-white'
                        : 'text-zinc-400 hover:bg-zinc-900/90 hover:text-white'
                    }`}
                  >
                    <span className="flex items-center gap-3 min-w-0">
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </span>
                    {item.id === 'messages' && unreadMessagesCount > 0 && (
                      <span
                        className={`font-mono-num text-[11px] font-semibold shrink-0 ${
                          active ? 'text-orange-100' : 'text-orange-400'
                        }`}
                      >
                        {unreadMessagesCount}
                      </span>
                    )}
                    {item.id === 'maintenance' && siteConfig.maintenanceEnabled && (
                      <span
                        className={`text-[10px] font-semibold uppercase tracking-wide shrink-0 ${
                          active ? 'text-orange-100' : 'text-orange-400'
                        }`}
                      >
                        ВКЛ
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="p-5 border-t border-zinc-800/90 space-y-1.5">
            <button
              type="button"
              onClick={onBackToSite}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-lg transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              Сайт учеников
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-red-400 hover:bg-red-950/50 rounded-lg transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              Выйти из админки
            </button>
          </div>
        </aside>

        {/* Mobile Drawer */}
        {mobileNavOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div className="w-64 bg-[#101014] h-full border-r border-zinc-800 p-5 flex flex-col justify-between">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <span className="font-display font-bold text-white">Layf1x-TOP</span>
                  <button
                    type="button"
                    onClick={() => setMobileNavOpen(false)}
                    className="p-1 text-zinc-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <nav className="space-y-1">
                  {NAV_ITEMS.map((item) => {
                    const Icon = item.icon;
                    const active = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setActiveTab(item.id);
                          setMobileNavOpen(false);
                        }}
                        className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm font-medium rounded-lg cursor-pointer ${
                          active ? 'bg-orange-600 text-white' : 'text-zinc-300 hover:bg-zinc-900'
                        }`}
                      >
                        <span className="flex items-center gap-3">
                          <Icon className="w-4 h-4" />
                          {item.label}
                        </span>
                        {item.id === 'messages' && unreadMessagesCount > 0 && (
                          <span className="font-mono-num text-xs font-semibold">
                            {unreadMessagesCount}
                          </span>
                        )}
                        {item.id === 'maintenance' && siteConfig.maintenanceEnabled && (
                          <span className="text-[10px] font-semibold uppercase">ВКЛ</span>
                        )}
                      </button>
                    );
                  })}
                </nav>
              </div>

              <div className="space-y-1.5 border-t border-zinc-800 pt-4">
                <button
                  type="button"
                  onClick={onBackToSite}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-900 rounded-lg cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Сайт учеников
                </button>
                <button
                  type="button"
                  onClick={onLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:bg-red-950/50 rounded-lg cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  Выйти
                </button>
              </div>
            </div>
            <div className="flex-1 bg-black/70" onClick={() => setMobileNavOpen(false)} />
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Top Breadcrumb Bar */}
          <header className="sticky top-0 z-20 h-16 bg-[#070709]/85 backdrop-blur-md border-b border-zinc-800/90 px-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                aria-label="Открыть меню"
                className="lg:hidden p-2 -ml-2 text-zinc-400 hover:text-white cursor-pointer"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="text-sm text-zinc-400 flex items-center gap-2 truncate">
                <span className="hidden sm:inline">Layf1x-TOP</span>
                <span className="hidden sm:inline text-zinc-700">/</span>
                <span className="font-semibold text-white truncate">{currentNav.label}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={togglingSnow}
                onClick={handleQuickSnowToggle}
                title="Включить или выключить снег на сайте"
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60 ${
                  siteConfig.snowEnabled
                    ? 'bg-sky-600/20 border-sky-500/70 text-sky-300 hover:bg-sky-600/30'
                    : 'bg-[#121216]/90 border-zinc-800 text-zinc-300 hover:border-sky-500/50'
                }`}
              >
                <Snowflake className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">
                  {siteConfig.snowEnabled ? 'Снег: ВКЛ' : 'Снег: ВЫКЛ'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('news')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-zinc-200 bg-[#121216]/90 border border-zinc-800 hover:border-orange-500/60 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Новость
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('points')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-orange-600 hover:bg-orange-500 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Начислить баллы
              </button>
            </div>
          </header>

          <main className="flex-1 p-6 max-w-[1360px] w-full mx-auto space-y-6">
            {error && (
              <div className="p-4 bg-red-950/70 border border-red-900 rounded-lg text-sm text-red-300">
                {error}
              </div>
            )}

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-28 bg-[#121216]/90 border border-zinc-800 rounded-xl animate-pulse"
                  />
                ))}
              </div>
            ) : (
              <>
                {activeTab === 'overview' && (
                  <div className="space-y-6">
                    {/* Top 4 KPIs */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 bg-[#121216]/90 backdrop-blur-md border border-zinc-800 rounded-xl divide-y sm:divide-y-0 sm:divide-x divide-zinc-800">
                      <div className="p-5">
                        <div className="text-xs text-zinc-400">Ученики клуба</div>
                        <div className="mt-2 font-mono-num text-2xl font-semibold text-white">
                          {formatNumber(activeStudentsCount)}
                        </div>
                        <div className="mt-1 text-xs text-zinc-500 font-mono-num">
                          Всего аккаунтов: {formatNumber(students.length)}
                        </div>
                      </div>

                      <div className="p-5">
                        <div className="text-xs text-zinc-400">Сумма баллов</div>
                        <div className="mt-2 font-mono-num text-2xl font-semibold text-orange-400">
                          {formatNumber(totalClubPoints)}
                        </div>
                        <div className="mt-1 text-xs text-zinc-500 font-mono-num">
                          Записей в журнале: {formatNumber(pointEvents.length)}
                        </div>
                      </div>

                      <div className="p-5">
                        <div className="text-xs text-zinc-400">Идеи и поддержка</div>
                        <div className="mt-2 font-mono-num text-2xl font-semibold text-white">
                          {formatNumber(inboxMessages.length)}
                        </div>
                        <button
                          type="button"
                          onClick={() => setActiveTab('messages')}
                          className="mt-1 text-xs font-medium text-orange-400 hover:underline cursor-pointer"
                        >
                          {unreadMessagesCount > 0
                            ? `Новых: ${unreadMessagesCount}`
                            : `Новостей: ${activeNewsCount} · Файлов: ${filesCount}`}
                        </button>
                      </div>

                      <div className="p-5">
                        <div className="text-xs text-zinc-400">Состояние сайта и снег</div>
                        <div
                          className={`mt-2 font-display text-xl font-bold ${
                            siteConfig.maintenanceEnabled ? 'text-orange-400' : 'text-emerald-400'
                          }`}
                        >
                          {siteConfig.maintenanceEnabled ? 'Техработы' : 'Открыт'}
                          <span className="text-xs font-normal text-zinc-400 ml-2">
                            · {siteConfig.snowEnabled ? 'Снег вкл' : 'Без снега'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setActiveTab('maintenance')}
                          className="mt-1 text-xs font-medium text-orange-400 hover:underline cursor-pointer"
                        >
                          Настроить режим и снег
                        </button>
                      </div>
                    </div>

                    {/* Top 5 Students + Active Marquee News */}
                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                      <div className="xl:col-span-7 bg-[#121216]/90 backdrop-blur-md border border-zinc-800 rounded-xl overflow-hidden">
                        <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
                          <h2 className="font-display text-base font-bold text-white">
                            Лидеры по баллам
                          </h2>
                          <button
                            type="button"
                            onClick={() => setActiveTab('students')}
                            className="text-xs font-medium text-orange-400 hover:underline cursor-pointer"
                          >
                            Управление аккаунтами
                          </button>
                        </div>
                        {students.length === 0 ? (
                          <div className="p-8 text-center text-sm text-zinc-500">
                            Ученики ещё не добавлены. Создайте первого ученика во вкладке «Аккаунты учеников».
                          </div>
                        ) : (
                          <div className="divide-y divide-zinc-800/70">
                            {students.slice(0, 5).map((s, idx) => (
                              <div
                                key={s.id}
                                className="px-5 py-3 flex items-center justify-between gap-4"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <span className="font-mono-num text-xs font-semibold text-zinc-500 w-5">
                                    {idx + 1}
                                  </span>
                                  <span aria-hidden="true" className="text-zinc-300">
                                    {s.pieceSymbol}
                                  </span>
                                  <div className="min-w-0">
                                    <div className="text-sm font-medium text-white truncate">
                                      {s.fullName}
                                    </div>
                                    <div className="text-xs text-zinc-400">
                                      {s.groupName} · логин {s.username}
                                    </div>
                                  </div>
                                </div>
                                <div className="font-mono-num text-sm font-semibold text-orange-400 whitespace-nowrap">
                                  {formatNumber(s.totalPoints)} б.
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="xl:col-span-5 bg-[#121216]/90 backdrop-blur-md border border-zinc-800 rounded-xl overflow-hidden">
                        <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
                          <h2 className="font-display text-base font-bold text-white">
                            Новости в бегущей строке
                          </h2>
                          <button
                            type="button"
                            onClick={() => setActiveTab('news')}
                            className="text-xs font-medium text-orange-400 hover:underline cursor-pointer"
                          >
                            Все новости
                          </button>
                        </div>
                        {news.length === 0 ? (
                          <div className="p-8 text-center text-sm text-zinc-500">
                            Новостей пока нет.
                          </div>
                        ) : (
                          <div className="divide-y divide-zinc-800/70">
                            {news.slice(0, 5).map((item) => (
                              <div key={item.id} className="px-5 py-3.5 space-y-1">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-sm font-medium text-white truncate">
                                    {item.title}
                                  </span>
                                  <span
                                    className={`text-[11px] shrink-0 ${
                                      item.active ? 'text-orange-400' : 'text-zinc-500'
                                    }`}
                                  >
                                    {item.active ? 'В строке' : 'Скрыта'}
                                  </span>
                                </div>
                                {item.fileName && (
                                  <div className="inline-flex items-center gap-1 text-xs text-zinc-400">
                                    <Paperclip className="w-3 h-3 text-orange-400" />
                                    <span className="truncate">{item.fileName}</span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Recent Point Events */}
                    <div className="bg-[#121216]/90 backdrop-blur-md border border-zinc-800 rounded-xl overflow-hidden">
                      <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
                        <h2 className="font-display text-base font-bold text-white">
                          Последние начисления баллов
                        </h2>
                        <button
                          type="button"
                          onClick={() => setActiveTab('points')}
                          className="text-xs font-medium text-orange-400 hover:underline cursor-pointer"
                        >
                          Открыть журнал
                        </button>
                      </div>
                      {pointEvents.length === 0 ? (
                        <div className="p-8 text-center text-sm text-zinc-500">
                          Начислений пока нет.
                        </div>
                      ) : (
                        <div className="divide-y divide-zinc-800/70">
                          {pointEvents.slice(0, 6).map((ev) => (
                            <div
                              key={ev.id}
                              className="px-5 py-3 flex items-center justify-between gap-4"
                            >
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-white truncate">
                                  {ev.studentName}
                                  <span className="mx-2 text-zinc-600">·</span>
                                  <span className="font-normal text-zinc-300">{ev.reason}</span>
                                </div>
                                <div className="text-xs text-zinc-500">
                                  {formatDateRu(ev.eventDate)} · {ev.category}
                                </div>
                              </div>
                              <div
                                className={`font-mono-num text-sm font-semibold whitespace-nowrap ${
                                  ev.delta >= 0 ? 'text-emerald-400' : 'text-red-400'
                                }`}
                              >
                                {ev.delta > 0
                                  ? `+${formatNumber(ev.delta)}`
                                  : formatNumber(ev.delta)}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'points' && (
                  <AdminPointsView students={students} events={pointEvents} />
                )}

                {activeTab === 'students' && <AdminStudentsView students={students} />}

                {activeTab === 'messages' && <AdminMessagesView messages={inboxMessages} />}

                {activeTab === 'news' && <AdminNewsView news={news} />}

                {activeTab === 'maintenance' && (
                  <AdminMaintenanceView siteConfig={siteConfig} />
                )}
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
