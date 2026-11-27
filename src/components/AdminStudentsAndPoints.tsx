import React, { useMemo, useState } from 'react';
import {
  Check,
  Copy,
  KeyRound,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import {
  awardPointsToStudents,
  bulkUpdateStudentsAi,
  createStudentAccount,
  deletePointEvent,
  deleteStudentAccount,
  resetStudentPassword,
  updateStudentStatusOrAi,
} from '../lib/clubStore';
import {
  formatDateRu,
  formatNumber,
  getChessRank,
  getTodayIso,
  POINT_CATEGORIES,
  STUDENT_GROUPS,
  type AdminStudent,
  type PublicPointEvent,
} from '../types';

const CHESS_PIECES = ['♟', '♞', '♝', '♜', '♛', '♚'] as const;

const CYR_MAP: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
  и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

function makeUsernameFromName(name: string): string {
  const parts = name
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '';
  const translit = (s: string) =>
    s
      .split('')
      .map((ch) => CYR_MAP[ch] ?? ch)
      .join('')
      .replace(/[^a-z0-9]/g, '');
  const first = translit(parts[0]);
  const second = parts[1] ? translit(parts[1]).slice(0, 2) : '';
  return second ? `${first}_${second}` : first;
}

function generateReadablePassword(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let out = '';
  const arr = new Uint32Array(8);
  crypto.getRandomValues(arr);
  for (let i = 0; i < 8; i++) {
    out += chars[arr[i] % chars.length];
  }
  return out;
}

// ===========================================================================
// 1. Admin Students Accounts Manager (Create accounts without Google)
// ===========================================================================
interface AdminStudentsViewProps {
  students: AdminStudent[];
}

export function AdminStudentsView({ students }: AdminStudentsViewProps) {
  const [search, setSearch] = useState('');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState(() => generateReadablePassword());
  const [groupName, setGroupName] = useState<string>(STUDENT_GROUPS[0]);
  const [pieceSymbol, setPieceSymbol] = useState<string>('♞');
  const [initialPoints, setInitialPoints] = useState('0');
  const [notes, setNotes] = useState('');
  const [aiEnabled, setAiEnabled] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [bulkAiUpdating, setBulkAiUpdating] = useState(false);

  const [lastCredentials, setLastCredentials] = useState<{
    fullName: string;
    username: string;
    password: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const [resetTarget, setResetTarget] = useState<AdminStudent | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.fullName.toLowerCase().includes(q) ||
        s.username.toLowerCase().includes(q) ||
        s.groupName.toLowerCase().includes(q)
    );
  }, [students, search]);

  async function handleCreateStudent(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setCreating(true);
    try {
      const createdName = fullName.trim();
      const createdUser = username.trim().toLowerCase();
      const createdPass = password;

      await createStudentAccount({
        fullName: createdName,
        username: createdUser,
        password: createdPass,
        groupName,
        pieceSymbol,
        initialPoints: Number(initialPoints) || 0,
        notes,
        aiEnabled,
        existingUsernames: students.map((s) => s.username.toLowerCase()),
        todayIso: getTodayIso(),
      });

      setLastCredentials({
        fullName: createdName,
        username: createdUser,
        password: createdPass,
      });
      setCopied(false);
      setFullName('');
      setUsername('');
      setPassword(generateReadablePassword());
      setInitialPoints('0');
      setNotes('');
      setAiEnabled(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Не удалось создать аккаунт');
    } finally {
      setCreating(false);
    }
  }

  async function handleCopyCredentials() {
    if (!lastCredentials) return;
    const text = `Шахматный клуб Layf1x-TOP\nУченик: ${lastCredentials.fullName}\nЛогин: ${lastCredentials.username}\nПароль: ${lastCredentials.password}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      // ignore
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!resetTarget) return;
    setResetError(null);
    setResetting(true);
    try {
      await resetStudentPassword(resetTarget, newPassword);
      setLastCredentials({
        fullName: resetTarget.fullName,
        username: resetTarget.username,
        password: newPassword,
      });
      setCopied(false);
      setResetTarget(null);
      setNewPassword('');
    } catch (err) {
      setResetError(err instanceof Error ? err.message : 'Не удалось обновить пароль');
    } finally {
      setResetting(false);
    }
  }

  async function handleToggleActive(student: AdminStudent) {
    try {
      await updateStudentStatusOrAi(student, { active: !student.active });
    } catch {
      // ignore
    }
  }

  async function handleToggleAi(student: AdminStudent) {
    try {
      await updateStudentStatusOrAi(student, { aiEnabled: !student.aiEnabled });
    } catch {
      // ignore
    }
  }

  async function handleBulkAi(enabled: boolean) {
    setBulkAiUpdating(true);
    try {
      await bulkUpdateStudentsAi(students, enabled);
    } catch {
      // ignore
    } finally {
      setBulkAiUpdating(false);
    }
  }

  async function handleDeleteStudent(student: AdminStudent) {
    try {
      await deleteStudentAccount(student);
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-6">
      {lastCredentials && (
        <div className="bg-orange-950/40 backdrop-blur-md border border-orange-800/80 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-semibold text-orange-400">
              Данные для входа ученика готовы (без Google)
            </div>
            <div className="text-sm text-zinc-100">
              <span className="font-semibold text-white">{lastCredentials.fullName}</span>
              <span className="mx-2 text-zinc-500">·</span>
              Логин:{' '}
              <span className="font-mono-num font-semibold text-orange-300">
                {lastCredentials.username}
              </span>
              <span className="mx-2 text-zinc-500">·</span>
              Пароль:{' '}
              <span className="font-mono-num font-semibold text-orange-300">
                {lastCredentials.password}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopyCredentials}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-orange-200 bg-orange-950 border border-orange-700 hover:bg-orange-900 rounded-lg cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Скопировано' : 'Скопировать для ученика'}
            </button>
            <button
              type="button"
              onClick={() => setLastCredentials(null)}
              aria-label="Скрыть карточку"
              className="p-1.5 text-orange-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Create Student Account Form */}
        <div className="xl:col-span-4 bg-[#121216]/90 backdrop-blur-md border border-zinc-800 rounded-xl p-5 space-y-4">
          <div>
            <h2 className="font-display text-base font-bold text-white">
              Создать аккаунт ученику
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Ученик сможет войти на сайте с любого устройства по логину и паролю без Google-аккаунта.
            </p>
          </div>

          {formError && (
            <div className="p-2.5 bg-red-950/60 border border-red-900 rounded-lg text-xs text-red-300">
              {formError}
            </div>
          )}

          <form onSubmit={handleCreateStudent} className="space-y-3.5">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-zinc-300">Имя и фамилия</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => {
                  const val = e.target.value;
                  setFullName(val);
                  if (!username || username === makeUsernameFromName(fullName)) {
                    setUsername(makeUsernameFromName(val));
                  }
                }}
                placeholder="Например: Иван Смирнов"
                className="w-full px-3 py-2 text-sm bg-[#09090B] text-white placeholder:text-zinc-600 border border-zinc-800 rounded-lg focus:outline-none focus:border-orange-500"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-zinc-300">
                Логин для входа (латиница)
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="ivan_sm"
                className="w-full px-3 py-2 text-sm font-mono-num bg-[#09090B] text-white placeholder:text-zinc-600 border border-zinc-800 rounded-lg focus:outline-none focus:border-orange-500"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium text-zinc-300">Пароль ученика</label>
                <button
                  type="button"
                  onClick={() => setPassword(generateReadablePassword())}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-orange-400 hover:underline cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  Сгенерировать
                </button>
              </div>
              <input
                type="text"
                required
                minLength={4}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono-num bg-[#09090B] text-white border border-zinc-800 rounded-lg focus:outline-none focus:border-orange-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-zinc-300">Группа</label>
                <select
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[#09090B] text-white border border-zinc-800 rounded-lg focus:outline-none focus:border-orange-500"
                >
                  {STUDENT_GROUPS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-zinc-300">Стартовые баллы</label>
                <input
                  type="number"
                  value={initialPoints}
                  onChange={(e) => setInitialPoints(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono-num bg-[#09090B] text-white border border-zinc-800 rounded-lg focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-zinc-300">Шахматная фигура</label>
              <div className="flex items-center gap-1.5">
                {CHESS_PIECES.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPieceSymbol(p)}
                    className={`w-9 h-9 rounded-lg border text-lg flex items-center justify-center cursor-pointer ${
                      pieceSymbol === p
                        ? 'border-orange-500 bg-orange-950/70 text-orange-400'
                        : 'border-zinc-800 text-zinc-300 hover:bg-zinc-900'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-zinc-300">
                Заметка тренера (видна только в админке)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Телефон родителя, цель на сезон..."
                className="w-full px-3 py-2 text-sm bg-[#09090B] text-white placeholder:text-zinc-600 border border-zinc-800 rounded-lg focus:outline-none focus:border-orange-500"
              />
            </div>

            <label className="flex items-center justify-between gap-3 px-3 py-2.5 bg-[#09090B] border border-zinc-800 rounded-lg cursor-pointer">
              <span className="flex items-center gap-2 text-xs text-zinc-200">
                <Sparkles className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                <span>Доступ к кнопке «Помощник» в кабинете</span>
              </span>
              <input
                type="checkbox"
                checked={aiEnabled}
                onChange={(e) => setAiEnabled(e.target.checked)}
                className="rounded border-zinc-700 bg-zinc-900 accent-orange-500"
              />
            </label>

            <button
              type="submit"
              disabled={creating}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-medium text-white bg-orange-600 hover:bg-orange-500 disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              {creating ? 'Создание...' : 'Создать аккаунт'}
            </button>
          </form>
        </div>

        {/* Students Table */}
        <div className="xl:col-span-8 bg-[#121216]/90 backdrop-blur-md border border-zinc-800 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-zinc-800 flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-bold text-white">
                  Аккаунты учеников ({students.length})
                </h2>
                <p className="text-xs text-zinc-400">
                  Сброс пароля, статус доступа и выдача кнопки «Помощник» (вкл/выкл).
                </p>
              </div>
              <div className="relative">
                <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Поиск по имени или логину..."
                  className="w-full sm:w-60 pl-9 pr-3 py-1.5 text-sm bg-[#09090B] text-white placeholder:text-zinc-600 border border-zinc-800 rounded-lg focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>

            {students.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-800/70 text-xs">
                <span className="inline-flex items-center gap-1.5 text-zinc-400">
                  <Sparkles className="w-3.5 h-3.5 text-orange-400" />
                  Кнопка «Шахматный помощник» в кабинетах:
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={bulkAiUpdating}
                    onClick={() => handleBulkAi(true)}
                    className="px-2.5 py-1 font-medium text-orange-300 bg-orange-950/60 border border-orange-800/70 hover:bg-orange-900/60 rounded-md transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Включить всем
                  </button>
                  <button
                    type="button"
                    disabled={bulkAiUpdating}
                    onClick={() => handleBulkAi(false)}
                    className="px-2.5 py-1 font-medium text-zinc-400 bg-zinc-900 border border-zinc-800 hover:text-white rounded-md transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Выключить всем
                  </button>
                </div>
              </div>
            )}
          </div>

          {filteredStudents.length === 0 ? (
            <div className="p-10 text-center text-sm text-zinc-500">
              Ученики не найдены. Создайте первый аккаунт в форме слева.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#18181D] border-b border-zinc-800 text-xs text-zinc-400">
                  <tr>
                    <th className="py-3 px-5 font-medium">Ученик</th>
                    <th className="py-3 px-4 font-medium">Логин</th>
                    <th className="py-3 px-4 font-medium text-right">Баллы</th>
                    <th className="py-3 px-4 font-medium">Помощник</th>
                    <th className="py-3 px-4 font-medium">Статус</th>
                    <th className="py-3 px-5 font-medium text-right">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/70">
                  {filteredStudents.map((s) => {
                    const rank = getChessRank(s.totalPoints);
                    return (
                      <tr key={s.id} className="hover:bg-zinc-900/60">
                        <td className="py-3 px-5">
                          <div className="font-medium text-white flex items-center gap-2">
                            <span aria-hidden="true" className="text-zinc-300">
                              {s.pieceSymbol}
                            </span>
                            <span>{s.fullName}</span>
                          </div>
                          <div className="text-xs text-zinc-400">
                            {s.groupName} · {rank.title}
                            {s.notes ? ` · ${s.notes}` : ''}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono-num text-xs text-zinc-300">
                          {s.username}
                        </td>
                        <td className="py-3 px-4 text-right font-mono-num font-semibold text-white">
                          {formatNumber(s.totalPoints)}
                        </td>
                        <td className="py-3 px-4 text-xs whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleToggleAi(s)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border font-medium transition-colors cursor-pointer ${
                              s.aiEnabled
                                ? 'bg-orange-600/20 border-orange-500/60 text-orange-300 hover:bg-orange-600/30'
                                : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-200'
                            }`}
                          >
                            <Sparkles className="w-3 h-3" />
                            {s.aiEnabled ? 'Вкл' : 'Выкл'}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-xs">
                          <button
                            type="button"
                            onClick={() => handleToggleActive(s)}
                            className={`font-medium cursor-pointer hover:underline ${
                              s.active ? 'text-emerald-400' : 'text-zinc-500'
                            }`}
                          >
                            {s.active ? 'Активен' : 'Отключён'}
                          </button>
                        </td>
                        <td className="py-3 px-5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setResetTarget(s);
                                setNewPassword(generateReadablePassword());
                                setResetError(null);
                              }}
                              title="Задать новый пароль"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 rounded-md cursor-pointer"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                              Пароль
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteStudent(s)}
                              aria-label={`Удалить ${s.fullName}`}
                              className="p-1.5 text-zinc-500 hover:text-red-400 rounded-md cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Reset Student Password Modal */}
      {resetTarget && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-[2px] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-[#121216] border border-zinc-800 rounded-xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-display text-lg font-bold text-white">
                  Новый пароль для ученика
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {resetTarget.fullName} · логин {resetTarget.username}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setResetTarget(null)}
                className="p-1 text-zinc-500 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {resetError && (
              <div className="p-2.5 bg-red-950/60 border border-red-900 rounded-lg text-xs text-red-300">
                {resetError}
              </div>
            )}

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-zinc-300">Новый пароль</label>
                  <button
                    type="button"
                    onClick={() => setNewPassword(generateReadablePassword())}
                    className="text-xs font-medium text-orange-400 hover:underline cursor-pointer"
                  >
                    Сгенерировать
                  </button>
                </div>
                <input
                  type="text"
                  required
                  minLength={4}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono-num bg-[#09090B] text-white border border-zinc-800 rounded-lg focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setResetTarget(null)}
                  className="px-4 py-2 text-sm text-zinc-400 hover:text-white cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={resetting}
                  className="px-4 py-2 text-sm font-medium text-white bg-orange-600 hover:bg-orange-500 rounded-lg cursor-pointer"
                >
                  {resetting ? 'Сохранение...' : 'Сохранить пароль'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ===========================================================================
// 2. Admin Points Awarding & History Workbench
// ===========================================================================
interface AdminPointsViewProps {
  students: AdminStudent[];
  events: PublicPointEvent[];
}

const POINT_PRESETS = [
  { label: '+15 Посещение', delta: 15, category: 'Занятие', reason: 'Участие и работа на занятии' },
  { label: '+30 Победа в партии', delta: 30, category: 'Партия', reason: 'Победа в тренировочной партии' },
  { label: '+40 Тактика', delta: 40, category: 'Тактика', reason: 'Успешное решение серии задач' },
  { label: '+100 Турнир', delta: 100, category: 'Турнир', reason: 'Призовое место в клубном турнире' },
  { label: '−15 Штраф', delta: -15, category: 'Штраф', reason: 'Нарушение правил на занятии' },
];

export function AdminPointsView({ students, events }: AdminPointsViewProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(students[0] ? [students[0].id] : []);
  const [delta, setDelta] = useState('25');
  const [category, setCategory] = useState<string>(POINT_CATEGORIES[0]);
  const [reason, setReason] = useState('');
  const [eventDate, setEventDate] = useState(getTodayIso());
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [filterStudentId, setFilterStudentId] = useState<string>('all');

  const filteredEvents = useMemo(() => {
    if (filterStudentId === 'all') return events;
    return events.filter((e) => e.studentId === filterStudentId);
  }, [events, filterStudentId]);

  const studentsById = useMemo(
    () => new Map(students.map((s) => [s.id, s])),
    [students]
  );

  function toggleStudent(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  function selectGroup(group: string) {
    const ids = students.filter((s) => s.groupName === group && s.active).map((s) => s.id);
    setSelectedIds(ids);
  }

  async function handleAwardSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (selectedIds.length === 0) {
      setError('Отметьте хотя бы одного ученика');
      return;
    }
    const parsedDelta = Math.trunc(Number(delta));
    if (!Number.isFinite(parsedDelta) || parsedDelta === 0) {
      setError('Укажите ненулевое количество баллов');
      return;
    }
    setSubmitting(true);
    try {
      await awardPointsToStudents({
        students,
        selectedIds,
        delta: parsedDelta,
        category,
        reason,
        eventDate,
      });
      setReason('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка начисления баллов');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteEvent(ev: PublicPointEvent) {
    try {
      await deletePointEvent(ev, studentsById.get(ev.studentId));
    } catch {
      // ignore
    }
  }

  const uniqueGroups = Array.from(new Set(students.map((s) => s.groupName)));

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      {/* Award / Deduct Workbench */}
      <div className="xl:col-span-5 bg-[#121216]/90 backdrop-blur-md border border-zinc-800 rounded-xl p-5 space-y-4">
        <div>
          <h2 className="font-display text-base font-bold text-white">
            Начислить или списать баллы
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Можно выбрать одного ученика или всю группу разом за проведённый урок.
          </p>
        </div>

        {/* Presets */}
        <div className="flex flex-wrap gap-1.5">
          {POINT_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => {
                setDelta(String(p.delta));
                setCategory(p.category);
                setReason(p.reason);
              }}
              className="px-2.5 py-1 text-xs font-medium bg-zinc-900 border border-zinc-800 hover:border-zinc-600 text-zinc-200 rounded-md transition-colors cursor-pointer"
            >
              {p.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="p-2.5 bg-red-950/60 border border-red-900 rounded-lg text-xs text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleAwardSubmit} className="space-y-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-medium text-zinc-300">
                Ученики (выбрано: {selectedIds.length})
              </label>
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                {uniqueGroups.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => selectGroup(g)}
                    className="text-orange-400 hover:underline cursor-pointer"
                  >
                    {g}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setSelectedIds([])}
                  className="text-zinc-500 hover:text-zinc-200 cursor-pointer"
                >
                  Сброс
                </button>
              </div>
            </div>

            <div className="max-h-48 overflow-y-auto border border-zinc-800 rounded-lg divide-y divide-zinc-800/70 bg-[#09090B]">
              {students.length === 0 ? (
                <div className="p-4 text-xs text-zinc-500 text-center">
                  Сначала добавьте учеников во вкладке «Аккаунты учеников».
                </div>
              ) : (
                students.map((s) => {
                  const checked = selectedIds.includes(s.id);
                  return (
                    <label
                      key={s.id}
                      className={`flex items-center justify-between px-3 py-2 text-sm cursor-pointer transition-colors ${
                        checked ? 'bg-orange-950/40' : 'hover:bg-zinc-900/70'
                      }`}
                    >
                      <span className="flex items-center gap-2.5 min-w-0">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleStudent(s.id)}
                          className="rounded border-zinc-700 bg-zinc-900 text-orange-500 focus:ring-orange-500 accent-orange-500"
                        />
                        <span className="truncate font-medium text-zinc-100">{s.fullName}</span>
                      </span>
                      <span className="font-mono-num text-xs text-zinc-400 shrink-0 ml-2">
                        {formatNumber(s.totalPoints)} б.
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-zinc-300">
                Баллы (+ или −)
              </label>
              <input
                type="number"
                required
                value={delta}
                onChange={(e) => setDelta(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono-num bg-[#09090B] text-white border border-zinc-800 rounded-lg focus:outline-none focus:border-orange-500"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-zinc-300">Дата</label>
              <input
                type="date"
                required
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono-num bg-[#09090B] text-white border border-zinc-800 rounded-lg focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-zinc-300">Категория</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-[#09090B] text-white border border-zinc-800 rounded-lg focus:outline-none focus:border-orange-500"
            >
              {POINT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-zinc-300">Причина</label>
            <input
              type="text"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Например: Решил 20 тактических задач"
              className="w-full px-3 py-2 text-sm bg-[#09090B] text-white placeholder:text-zinc-600 border border-zinc-800 rounded-lg focus:outline-none focus:border-orange-500"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-medium text-white bg-orange-600 hover:bg-orange-500 disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            {submitting
              ? 'Сохранение...'
              : selectedIds.length > 1
                ? `Применить к ${selectedIds.length} ученикам`
                : 'Записать баллы'}
          </button>
        </form>
      </div>

      {/* Points History Table */}
      <div className="xl:col-span-7 bg-[#121216]/90 backdrop-blur-md border border-zinc-800 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-bold text-white">
              Журнал начислений ({filteredEvents.length})
            </h2>
            <p className="text-xs text-zinc-400">
              Все операции по баллам сразу отражаются в рейтинге и кабинете ученика на всех устройствах.
            </p>
          </div>

          <select
            value={filterStudentId}
            onChange={(e) => setFilterStudentId(e.target.value)}
            className="px-3 py-1.5 text-xs bg-[#09090B] text-zinc-200 border border-zinc-800 rounded-lg focus:outline-none focus:border-orange-500"
          >
            <option value="all">Все ученики</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.fullName}
              </option>
            ))}
          </select>
        </div>

        {filteredEvents.length === 0 ? (
          <div className="p-10 text-center text-sm text-zinc-500">
            Начислений баллов пока нет.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#18181D] border-b border-zinc-800 text-xs text-zinc-400">
                <tr>
                  <th className="py-2.5 px-5 font-medium">Дата</th>
                  <th className="py-2.5 px-4 font-medium">Ученик</th>
                  <th className="py-2.5 px-4 font-medium">Причина</th>
                  <th className="py-2.5 px-4 font-medium text-right">Баллы</th>
                  <th className="py-2.5 px-3 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/70">
                {filteredEvents.map((ev) => (
                  <tr key={ev.id} className="hover:bg-zinc-900/60">
                    <td className="py-3 px-5 font-mono-num text-xs text-zinc-400 whitespace-nowrap">
                      {formatDateRu(ev.eventDate)}
                    </td>
                    <td className="py-3 px-4 font-medium text-white whitespace-nowrap">
                      {ev.studentName}
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-zinc-200">{ev.reason}</div>
                      <div className="text-xs text-zinc-500">{ev.category}</div>
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-mono-num font-semibold whitespace-nowrap ${
                        ev.delta >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {ev.delta > 0 ? `+${formatNumber(ev.delta)}` : formatNumber(ev.delta)}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteEvent(ev)}
                        aria-label="Удалить запись"
                        className="p-1.5 text-zinc-500 hover:text-red-400 rounded-md cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
