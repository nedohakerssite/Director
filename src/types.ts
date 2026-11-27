export interface ChessRankInfo {
  title: string;
  symbol: string;
  minPoints: number;
  nextPoints: number | null;
  nextTitle: string | null;
}

export const CHESS_RANKS: ChessRankInfo[] = [
  { title: 'Пешка', symbol: '♟', minPoints: 0, nextPoints: 150, nextTitle: 'Конь' },
  { title: 'Конь', symbol: '♞', minPoints: 150, nextPoints: 350, nextTitle: 'Слон' },
  { title: 'Слон', symbol: '♝', minPoints: 350, nextPoints: 650, nextTitle: 'Ладья' },
  { title: 'Ладья', symbol: '♜', minPoints: 650, nextPoints: 1000, nextTitle: 'Ферзь' },
  { title: 'Ферзь', symbol: '♛', minPoints: 1000, nextPoints: 1500, nextTitle: 'Гроссмейстер' },
  { title: 'Гроссмейстер', symbol: '♚', minPoints: 1500, nextPoints: null, nextTitle: null },
];

export function getChessRank(points: number): ChessRankInfo {
  let current = CHESS_RANKS[0];
  for (const rank of CHESS_RANKS) {
    if (points >= rank.minPoints) {
      current = rank;
    }
  }
  return current;
}

export const STUDENT_GROUPS = [
  'Начинающие',
  'Младшая группа',
  'Разрядники',
  'Турнирная группа',
] as const;

export const POINT_CATEGORIES = [
  'Занятие',
  'Партия',
  'Тактика',
  'Турнир',
  'Домашнее задание',
  'Бонус тренера',
  'Штраф',
] as const;

export interface SiteConfig {
  maintenanceEnabled: boolean;
  maintenanceTitle: string;
  maintenanceMessage: string;
  maintenanceUntil: string;
  snowEnabled: boolean;
}

export interface MaintenanceConfig {
  enabled: boolean;
  title: string;
  message: string;
  until: string;
}

export interface StudentSession {
  studentId: string;
  authKey: string;
  username: string;
}

export interface PublicStudent {
  id: string;
  fullName: string;
  username: string;
  groupName: string;
  pieceSymbol: string;
  totalPoints: number;
  eventsCount: number;
  monthDelta: number;
  aiEnabled: boolean;
  rank: number;
}

export interface PublicPointEvent {
  id: string;
  studentId: string;
  studentName: string;
  groupName: string;
  delta: number;
  category: string;
  reason: string;
  eventDate: string;
  createdAt: string;
}

export interface NewsItem {
  id: string;
  title: string;
  body: string;
  fileName: string | null;
  fileSize: number | null;
  fileMime?: string | null;
  hasFile: boolean;
  active: boolean;
  createdAt: string;
}

export interface PublicOverviewResponse {
  maintenance: MaintenanceConfig;
  snowEnabled: boolean;
  news: NewsItem[];
  students: PublicStudent[];
  recentEvents: PublicPointEvent[];
  groups: string[];
  stats: {
    totalStudents: number;
    totalPoints: number;
    eventsThisMonth: number;
    topScore: number;
  };
}

export interface StudentDashboardData {
  student: {
    id: string;
    fullName: string;
    username: string;
    groupName: string;
    pieceSymbol: string;
    totalPoints: number;
    clubRank: number;
    totalStudents: number;
    groupRank: number;
    groupTotal: number;
    monthDelta: number;
    aiEnabled: boolean;
  };
  history: {
    id: string;
    delta: number;
    category: string;
    reason: string;
    eventDate: string;
    createdAt: string;
  }[];
  categoryTotals: {
    category: string;
    points: number;
    count: number;
  }[];
}

export interface AdminStudent {
  id: string;
  fullName: string;
  username: string;
  groupName: string;
  pieceSymbol: string;
  notes: string;
  authKey: string;
  active: boolean;
  aiEnabled: boolean;
  totalPoints: number;
  eventsCount: number;
  createdAt: string;
}

export interface StudentAiMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  createdAt: string;
}

export type InboxMessageKind = 'idea' | 'support';
export type InboxMessageStatus = 'new' | 'accepted' | 'in_progress' | 'done';

export interface InboxMessage {
  id: string;
  kind: InboxMessageKind;
  studentId?: string;
  authorName: string;
  authorContact: string;
  subject: string;
  message: string;
  status: InboxMessageStatus;
  adminNote: string;
  upvotes: number;
  downvotes: number;
  createdAt: string;
}

export interface PublicIdea {
  id: string;
  studentId: string;
  authorName: string;
  subject: string;
  message: string;
  status: InboxMessageStatus;
  upvotes: number;
  downvotes: number;
  score: number;
  userVote: -1 | 0 | 1;
  createdAt: string;
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('ru-RU').format(n);
}

export function formatFileSize(bytes: number | null): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} МБ`;
}

export function formatDateRu(isoDate: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate;
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(dt);
}

export function getTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
