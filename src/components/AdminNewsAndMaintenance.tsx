import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Download,
  Eye,
  EyeOff,
  FileText,
  Megaphone,
  Paperclip,
  Plus,
  Power,
  Save,
  Snowflake,
  Trash2,
  X,
} from 'lucide-react';
import {
  createNewsItem,
  deleteNewsItem,
  downloadNewsFile,
  MAX_NEWS_FILE_BYTES,
  saveSiteConfig,
  toggleNewsItemActive,
} from '../lib/clubStore';
import { formatFileSize, type NewsItem, type SiteConfig } from '../types';

// ===========================================================================
// 1. Marquee News & File Attachments Manager (Real-time Cloud Sync)
// ===========================================================================
interface AdminNewsViewProps {
  news: NewsItem[];
}

export function AdminNewsView({ news }: AdminNewsViewProps) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [attachedFile, setAttachedFile] = useState<{
    name: string;
    size: number;
    mimeType: string;
    dataBase64: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) {
      setAttachedFile(null);
      return;
    }
    if (file.size > MAX_NEWS_FILE_BYTES) {
      setError('Файл слишком большой. Максимальный размер для облака — 650 КБ.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const commaIdx = result.indexOf(',');
      const base64 = commaIdx >= 0 ? result.slice(commaIdx + 1) : result;
      setAttachedFile({
        name: file.name,
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
        dataBase64: base64,
      });
    };
    reader.onerror = () => {
      setError('Не удалось прочитать выбранный файл');
    };
    reader.readAsDataURL(file);
  }

  async function handleCreateNews(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await createNewsItem({
        title,
        body,
        file: attachedFile,
      });
      setTitle('');
      setBody('');
      setAttachedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка добавления новости');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleActive(item: NewsItem) {
    setError(null);
    setBusyId(item.id);
    try {
      await toggleNewsItemActive(item);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось обновить статус новости');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeleteNews(id: string) {
    setError(null);
    setBusyId(id);
    try {
      await deleteNewsItem(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить новость');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDownload(item: NewsItem) {
    if (!item.fileName) return;
    setError(null);
    try {
      await downloadNewsFile(item.id, item.fileName);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось скачать файл');
    }
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      {/* Add News + File Form */}
      <div className="xl:col-span-5 bg-[#121216]/90 backdrop-blur-md border border-zinc-800 rounded-xl p-5 space-y-4">
        <div>
          <h2 className="font-display text-base font-bold text-white">
            Добавить новость в бегущую строку
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Новость и её удаление синхронизируются мгновенно на всех компьютерах и телефонах. Можно прикрепить файл до 650 КБ.
          </p>
        </div>

        {error && (
          <div className="p-2.5 bg-red-950/60 border border-red-900 rounded-lg text-xs text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleCreateNews} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-zinc-300">
              Заголовок / текст в бегущей строке
            </label>
            <input
              type="text"
              required
              maxLength={180}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Например: Домашнее задание по эндшпилю на субботу"
              className="w-full px-3 py-2 text-sm bg-[#09090B] text-white placeholder:text-zinc-600 border border-zinc-800 rounded-lg focus:outline-none focus:border-orange-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-zinc-300">
              Подробное описание (открывается по клику, необязательно)
            </label>
            <textarea
              rows={3}
              maxLength={1500}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Детали турнира, расписание или пояснение к прикреплённому файлу..."
              className="w-full px-3 py-2 text-sm bg-[#09090B] text-white placeholder:text-zinc-600 border border-zinc-800 rounded-lg focus:outline-none focus:border-orange-500 resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-zinc-300">
              Прикрепить файл (необязательно)
            </label>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.pgn,.doc,.docx,.xls,.xlsx,.csv,.zip"
              onChange={handleFileSelected}
              className="hidden"
              id="news-file-upload"
            />

            {attachedFile ? (
              <div className="flex items-center justify-between gap-3 px-3 py-2.5 bg-orange-950/30 border border-orange-800/70 rounded-lg">
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileText className="w-4 h-4 text-orange-400 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-white truncate">
                      {attachedFile.name}
                    </div>
                    <div className="text-[11px] text-zinc-400 font-mono-num">
                      {formatFileSize(attachedFile.size)}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAttachedFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  aria-label="Убрать файл"
                  className="p-1 text-zinc-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label
                htmlFor="news-file-upload"
                className="flex items-center justify-center gap-2 px-4 py-3 border border-dashed border-zinc-700 hover:border-orange-500/70 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 cursor-pointer transition-colors bg-[#09090B]/60"
              >
                <Paperclip className="w-4 h-4 text-orange-400" />
                <span>Выбрать файл (PDF, PGN, фото, DOC, ZIP — до 650 КБ)</span>
              </label>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-medium text-white bg-orange-600 hover:bg-orange-500 disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            {submitting ? 'Публикация...' : 'Опубликовать в бегущую строку'}
          </button>
        </form>
      </div>

      {/* Existing News Items */}
      <div className="xl:col-span-7 bg-[#121216]/90 backdrop-blur-md border border-zinc-800 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-base font-bold text-white">
              Новости в бегущей строке ({news.length})
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Активные новости прокручиваются вверху сайта Layf1x-TOP на всех устройствах.
            </p>
          </div>
          <Megaphone className="w-4 h-4 text-orange-400 shrink-0" />
        </div>

        {news.length === 0 ? (
          <div className="p-10 text-center text-sm text-zinc-500">
            Новостей пока нет. Добавьте первую запись в форме слева.
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/80">
            {news.map((item) => (
              <div
                key={item.id}
                className="p-5 flex items-start justify-between gap-4 hover:bg-zinc-900/50"
              >
                <div className="min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm text-white">{item.title}</span>
                    <span
                      className={`text-xs font-medium ${
                        item.active ? 'text-orange-400' : 'text-zinc-500'
                      }`}
                    >
                      · {item.active ? 'Показывается' : 'Скрыта'}
                    </span>
                  </div>

                  {item.body && (
                    <p className="text-xs text-zinc-400 leading-relaxed">{item.body}</p>
                  )}

                  {item.fileName && item.hasFile && (
                    <button
                      type="button"
                      onClick={() => handleDownload(item)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-orange-400 hover:text-orange-300 hover:underline pt-1 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{item.fileName}</span>
                      {item.fileSize && (
                        <span className="text-zinc-500 font-mono-num">
                          ({formatFileSize(item.fileSize)})
                        </span>
                      )}
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => handleToggleActive(item)}
                    title={item.active ? 'Скрыть из строки' : 'Показать в строке'}
                    className="p-1.5 text-zinc-400 hover:text-white rounded-md cursor-pointer disabled:opacity-50"
                  >
                    {item.active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => handleDeleteNews(item.id)}
                    aria-label="Удалить новость"
                    className="p-1.5 text-zinc-500 hover:text-red-400 rounded-md cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ===========================================================================
// 2. Maintenance Mode & Snowfall Effect Control Panel (Real-time Cloud Sync)
// ===========================================================================
interface AdminMaintenanceViewProps {
  siteConfig: SiteConfig;
}

export function AdminMaintenanceView({ siteConfig }: AdminMaintenanceViewProps) {
  const [enabled, setEnabled] = useState(siteConfig.maintenanceEnabled);
  const [title, setTitle] = useState(siteConfig.maintenanceTitle);
  const [message, setMessage] = useState(siteConfig.maintenanceMessage);
  const [until, setUntil] = useState(siteConfig.maintenanceUntil);
  const [snowEnabled, setSnowEnabled] = useState(siteConfig.snowEnabled);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Sync live changes made on another device (PC <-> Phone)
  useEffect(() => {
    setEnabled(siteConfig.maintenanceEnabled);
    setTitle(siteConfig.maintenanceTitle);
    setMessage(siteConfig.maintenanceMessage);
    setUntil(siteConfig.maintenanceUntil);
    setSnowEnabled(siteConfig.snowEnabled);
  }, [
    siteConfig.maintenanceEnabled,
    siteConfig.maintenanceTitle,
    siteConfig.maintenanceMessage,
    siteConfig.maintenanceUntil,
    siteConfig.snowEnabled,
  ]);

  async function persistConfig(next: SiteConfig, noticeText: string) {
    setError(null);
    setSavedNotice(null);
    setSaving(true);
    try {
      await saveSiteConfig(next);
      setSavedNotice(noticeText);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить настройки');
    } finally {
      setSaving(false);
    }
  }

  function handleQuickToggleMaintenance() {
    const nextEnabled = !enabled;
    setEnabled(nextEnabled);
    persistConfig(
      {
        maintenanceEnabled: nextEnabled,
        maintenanceTitle: title,
        maintenanceMessage: message,
        maintenanceUntil: until,
        snowEnabled,
      },
      nextEnabled
        ? 'Режим техработ включён на всех устройствах (кроме /admin).'
        : 'Режим техработ выключен — сайт снова открыт для учеников.'
    );
  }

  function handleToggleSnow() {
    const nextSnow = !snowEnabled;
    setSnowEnabled(nextSnow);
    persistConfig(
      {
        maintenanceEnabled: enabled,
        maintenanceTitle: title,
        maintenanceMessage: message,
        maintenanceUntil: until,
        snowEnabled: nextSnow,
      },
      nextSnow
        ? 'Снег включён и сразу появился на всех устройствах.'
        : 'Снег выключен на всех устройствах.'
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    persistConfig(
      {
        maintenanceEnabled: enabled,
        maintenanceTitle: title,
        maintenanceMessage: message,
        maintenanceUntil: until,
        snowEnabled,
      },
      'Тексты экрана техработ сохранены и сразу синхронизированы.'
    );
  }

  return (
    <div className="space-y-6">
      {/* Snowfall Effect Card */}
      <div className="bg-[#121216]/90 backdrop-blur-md border border-zinc-800 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="font-display text-lg font-bold text-white flex items-center gap-2">
            <Snowflake className="w-5 h-5 text-sky-400" />
            Снег на сайте
          </h2>
          <p className="text-xs text-zinc-400">
            Включает или выключает плавный падающий снег поверх страниц сайта Layf1x-TOP на компьютере и телефоне.
          </p>
          <div className="text-xs pt-1">
            Состояние:{' '}
            <span className={`font-semibold ${snowEnabled ? 'text-sky-400' : 'text-zinc-500'}`}>
              {snowEnabled ? 'Снег включён' : 'Снег выключен'}
            </span>
          </div>
        </div>

        <button
          type="button"
          disabled={saving}
          onClick={handleToggleSnow}
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60 ${
            snowEnabled
              ? 'bg-sky-600 hover:bg-sky-500 text-white'
              : 'bg-zinc-900 border border-zinc-700 hover:border-sky-500/60 text-zinc-200'
          }`}
        >
          <Snowflake className="w-4 h-4" />
          {snowEnabled ? 'Выключить снег' : 'Включить снег'}
        </button>
      </div>

      {/* Maintenance Mode Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-7 bg-[#121216]/90 backdrop-blur-md border border-zinc-800 rounded-xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-zinc-800">
            <div>
              <h2 className="font-display text-lg font-bold text-white">
                Режим технических работ
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                При включении блокируются все страницы сайта (главная, /ides, /Layf1x) на всех устройствах. Доступной остаётся только /admin.
              </p>
            </div>

            <button
              type="button"
              disabled={saving}
              onClick={handleQuickToggleMaintenance}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60 ${
                enabled
                  ? 'bg-red-600 hover:bg-red-500 text-white'
                  : 'bg-orange-600 hover:bg-orange-500 text-white'
              }`}
            >
              <Power className="w-4 h-4" />
              {enabled ? 'Выключить техработы' : 'Включить техработы'}
            </button>
          </div>

          <div className="text-sm">
            Текущее состояние сайта:{' '}
            <span className={`font-semibold ${enabled ? 'text-orange-400' : 'text-emerald-400'}`}>
              {enabled
                ? 'Режим техработ активен (все страницы кроме /admin закрыты)'
                : 'Сайт работает в обычном режиме'}
            </span>
          </div>

          {error && (
            <div className="p-3 bg-red-950/60 border border-red-900 rounded-lg text-xs text-red-300">
              {error}
            </div>
          )}

          {savedNotice && (
            <div className="p-3 bg-emerald-950/50 border border-emerald-800 rounded-lg text-xs text-emerald-300">
              {savedNotice}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-300">
                Заголовок на экране техработ
              </label>
              <input
                type="text"
                required
                maxLength={140}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#09090B] text-white border border-zinc-800 rounded-lg focus:outline-none focus:border-orange-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-300">
                Сообщение для учеников
              </label>
              <textarea
                rows={3}
                maxLength={600}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#09090B] text-white border border-zinc-800 rounded-lg focus:outline-none focus:border-orange-500 resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-300">
                Ориентировочное время окончания (необязательно)
              </label>
              <input
                type="text"
                maxLength={80}
                value={until}
                onChange={(e) => setUntil(e.target.value)}
                placeholder="Например: Сегодня до 19:00 МСК"
                className="w-full px-3 py-2 text-sm bg-[#09090B] text-white placeholder:text-zinc-600 border border-zinc-800 rounded-lg focus:outline-none focus:border-orange-500"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-orange-600 hover:bg-orange-500 disabled:opacity-60 rounded-lg cursor-pointer"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Сохранение...' : 'Сохранить текст экрана'}
            </button>
          </form>
        </div>

        {/* Live Preview */}
        <div className="xl:col-span-5 bg-[#121216]/90 backdrop-blur-md border border-zinc-800 rounded-xl p-6 space-y-4">
          <div className="text-xs font-medium text-zinc-400">
            Предпросмотр экрана для посетителей
          </div>

          <div className="bg-[#09090B] border border-zinc-800 rounded-xl p-6 text-center space-y-3">
            <div className="w-11 h-11 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-5 h-5 text-orange-400" />
            </div>
            <div className="text-xs font-medium text-orange-400">Layf1x-TOP</div>
            <h3 className="font-display text-lg font-bold text-white">
              {title || 'Технические работы в Layf1x-TOP'}
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {message || 'Мы скоро вернёмся.'}
            </p>
            {until.trim() && (
              <div className="pt-2 text-xs font-mono-num text-zinc-300">
                Ориентировочно: {until}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
