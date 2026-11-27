import { useCallback, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { AdminAuthGate } from './components/AdminAuthGate';
import { AdminPanel } from './components/AdminPanel';
import { ErrorBoundary } from './components/ErrorBoundary';
import { IdeasPage, SupportPage } from './components/PublicFeedbackPages';
import { PublicPortal } from './components/PublicPortal';
import { SnowfallOverlay } from './components/SnowfallOverlay';
import { ADMIN_BOOTSTRAP_EMAIL, auth, db } from './firebase';
import {
  DEFAULT_SITE_CONFIG,
  subscribePointEvents,
  subscribePublicNews,
  subscribePublicStudents,
  subscribeSiteConfig,
  type RawStudentDoc,
} from './lib/clubStore';
import type {
  NewsItem,
  PublicOverviewResponse,
  PublicPointEvent,
  PublicStudent,
  SiteConfig,
  StudentDashboardData,
  StudentSession,
} from './types';

function isAdminPath(pathname: string): boolean {
  return pathname === '/admin' || pathname.startsWith('/admin/');
}

function isIdeasPath(pathname: string): boolean {
  const lower = pathname.toLowerCase();
  return lower === '/ides' || lower.startsWith('/ides/');
}

function isSupportPath(pathname: string): boolean {
  const lower = pathname.toLowerCase();
  return lower === '/layf1x' || lower.startsWith('/layf1x/');
}

function getMonthCutoffIso(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function AppContent() {
  const [pathname, setPathname] = useState<string>(() => window.location.pathname);

  // Firebase Admin Auth state (for /admin only)
  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [isAdminVerified, setIsAdminVerified] = useState(false);

  // In-memory student session (no Google, never stored in localStorage)
  const [studentSession, setStudentSession] = useState<StudentSession | null>(null);

  // Real-time cloud Firestore state (synced instantly between PC & Phone)
  const [siteConfig, setSiteConfig] = useState<SiteConfig>(DEFAULT_SITE_CONFIG);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [rawStudents, setRawStudents] = useState<RawStudentDoc[]>([]);
  const [studentsLoaded, setStudentsLoaded] = useState(false);
  const [pointEvents, setPointEvents] = useState<PublicPointEvent[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  const navigate = useCallback((nextPath: string) => {
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }
    setPathname(nextPath);
    window.scrollTo({ top: 0 });
  }, []);

  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Track Firebase Admin Auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (!user) {
        setIsAdminVerified(false);
        setAuthReady(true);
        return;
      }

      if (user.emailVerified && user.email?.toLowerCase() === ADMIN_BOOTSTRAP_EMAIL) {
        setIsAdminVerified(true);
        setAuthReady(true);
        return;
      }

      try {
        const adminSnap = await getDoc(doc(db, 'admins', user.uid));
        setIsAdminVerified(Boolean(user.emailVerified && adminSnap.exists()));
      } catch {
        setIsAdminVerified(false);
      } finally {
        setAuthReady(true);
      }
    });
    return () => unsub();
  }, []);

  // Global real-time subscription to site_config (maintenance mode + snowfall)
  useEffect(() => {
    const unsub = subscribeSiteConfig(
      (cfg) => {
        setSiteConfig(cfg);
        setConfigLoaded(true);
      },
      (err) => {
        setOverviewError(err instanceof Error ? err.message : 'Ошибка загрузки настроек сайта');
        setConfigLoaded(true);
      }
    );
    return () => unsub();
  }, []);

  // Public real-time subscriptions for students, points, and running news
  useEffect(() => {
    const onErr = (err: unknown) => {
      setOverviewError(err instanceof Error ? err.message : 'Ошибка синхронизации рейтинга');
      setStudentsLoaded(true);
    };

    const unsubStudents = subscribePublicStudents((list) => {
      setRawStudents(list);
      setStudentsLoaded(true);
    }, onErr);
    const unsubEvents = subscribePointEvents(false, setPointEvents, onErr);
    const unsubNews = subscribePublicNews(setNews, onErr);

    return () => {
      unsubStudents();
      unsubEvents();
      unsubNews();
    };
  }, []);

  // Derive leaderboard, stats & student personal cabinet reactively from live Firestore state
  const overview = useMemo<PublicOverviewResponse>(() => {
    const cutoff = getMonthCutoffIso();
    const monthDeltaByStudent = new Map<string, number>();
    let eventsThisMonth = 0;

    for (const ev of pointEvents) {
      if (ev.eventDate >= cutoff) {
        eventsThisMonth += 1;
        monthDeltaByStudent.set(
          ev.studentId,
          (monthDeltaByStudent.get(ev.studentId) ?? 0) + ev.delta
        );
      }
    }

    const sortedStudents: PublicStudent[] = [...rawStudents]
      .sort(
        (a, b) =>
          b.totalPoints - a.totalPoints || a.fullName.localeCompare(b.fullName, 'ru')
      )
      .map((s, idx) => ({
        id: s.id,
        fullName: s.fullName,
        username: s.username,
        groupName: s.groupName,
        pieceSymbol: s.pieceSymbol,
        totalPoints: s.totalPoints,
        eventsCount: s.eventsCount,
        monthDelta: monthDeltaByStudent.get(s.id) ?? 0,
        aiEnabled: s.aiEnabled,
        rank: idx + 1,
      }));

    const groups = Array.from(new Set(sortedStudents.map((s) => s.groupName)));
    const totalPoints = sortedStudents.reduce((acc, s) => acc + s.totalPoints, 0);
    const topScore = sortedStudents.length > 0 ? sortedStudents[0].totalPoints : 0;

    return {
      maintenance: {
        enabled: siteConfig.maintenanceEnabled,
        title: siteConfig.maintenanceTitle,
        message: siteConfig.maintenanceMessage,
        until: siteConfig.maintenanceUntil,
      },
      snowEnabled: siteConfig.snowEnabled,
      news,
      students: sortedStudents,
      recentEvents: pointEvents.slice(0, 25),
      groups,
      stats: {
        totalStudents: sortedStudents.length,
        totalPoints,
        eventsThisMonth,
        topScore,
      },
    };
  }, [rawStudents, pointEvents, news, siteConfig]);

  const studentData = useMemo<StudentDashboardData | null>(() => {
    if (!studentSession) return null;
    const current = overview.students.find((s) => s.id === studentSession.studentId);
    if (!current) return null;

    const sameGroup = overview.students.filter((s) => s.groupName === current.groupName);
    const groupIdx = sameGroup.findIndex((s) => s.id === current.id);

    const history = pointEvents
      .filter((ev) => ev.studentId === current.id)
      .slice(0, 100)
      .map((ev) => ({
        id: ev.id,
        delta: ev.delta,
        category: ev.category,
        reason: ev.reason,
        eventDate: ev.eventDate,
        createdAt: ev.createdAt,
      }));

    const catMap = new Map<string, { points: number; count: number }>();
    for (const h of history) {
      const prev = catMap.get(h.category) ?? { points: 0, count: 0 };
      prev.points += h.delta;
      prev.count += 1;
      catMap.set(h.category, prev);
    }
    const categoryTotals = Array.from(catMap.entries())
      .map(([category, val]) => ({ category, points: val.points, count: val.count }))
      .sort((a, b) => b.points - a.points);

    return {
      student: {
        id: current.id,
        fullName: current.fullName,
        username: current.username,
        groupName: current.groupName,
        pieceSymbol: current.pieceSymbol,
        totalPoints: current.totalPoints,
        clubRank: current.rank,
        totalStudents: overview.students.length,
        groupRank: groupIdx >= 0 ? groupIdx + 1 : sameGroup.length,
        groupTotal: sameGroup.length,
        monthDelta: current.monthDelta,
        aiEnabled: current.aiEnabled,
      },
      history,
      categoryTotals,
    };
  }, [studentSession, overview.students, pointEvents]);

  async function handleAdminLogout() {
    await signOut(auth);
    setIsAdminVerified(false);
  }

  function handleStudentLogout() {
    setStudentSession(null);
  }

  const loading = !configLoaded || !studentsLoaded;

  if (isAdminPath(pathname)) {
    return (
      <>
        <SnowfallOverlay enabled={siteConfig.snowEnabled} />
        {!authReady ? (
          <div className="min-h-screen bg-[#070709] flex items-center justify-center text-sm text-zinc-400">
            Проверка доступа к /admin...
          </div>
        ) : firebaseUser && isAdminVerified ? (
          <AdminPanel
            adminEmail={firebaseUser.email ?? 'admin'}
            onLogout={handleAdminLogout}
            onBackToSite={() => navigate('/')}
          />
        ) : (
          <AdminAuthGate
            currentUser={firebaseUser}
            accessDenied={Boolean(firebaseUser && !isAdminVerified)}
            onBackToSite={() => navigate('/')}
          />
        )}
      </>
    );
  }

  if (!configLoaded && (isIdeasPath(pathname) || isSupportPath(pathname))) {
    return (
      <div className="min-h-screen bg-[#070709] flex items-center justify-center text-sm text-zinc-400">
        Загрузка...
      </div>
    );
  }

  // Maintenance mode blocks ALL routes except /admin across all devices in real time
  const maintenanceActive = Boolean(siteConfig.maintenanceEnabled);

  return (
    <>
      <SnowfallOverlay enabled={siteConfig.snowEnabled} />
      {!maintenanceActive && isIdeasPath(pathname) ? (
        <IdeasPage
          studentData={studentData}
          studentSession={studentSession}
          onStudentLoginSuccess={(session) => setStudentSession(session)}
          onBackToSite={() => navigate('/')}
        />
      ) : !maintenanceActive && isSupportPath(pathname) ? (
        <SupportPage studentData={studentData} onBackToSite={() => navigate('/')} />
      ) : (
        <PublicPortal
          overview={overview}
          loading={loading}
          error={overviewError}
          studentSession={studentSession}
          studentData={studentData}
          onStudentLoginSuccess={(session) => setStudentSession(session)}
          onStudentLogout={handleStudentLogout}
          onNavigatePath={navigate}
        />
      )}
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}
