import { useState } from 'react';
import { signInWithPopup, signOut, type User } from 'firebase/auth';
import { ArrowLeft, LogOut, ShieldCheck } from 'lucide-react';
import { ADMIN_BOOTSTRAP_EMAIL, auth, googleProvider } from '../firebase';
import { OrangeFlowBackground } from './OrangeFlowBackground';

interface AdminAuthGateProps {
  currentUser: User | null;
  accessDenied: boolean;
  onBackToSite: () => void;
}

export function AdminAuthGate({
  currentUser,
  accessDenied,
  onBackToSite,
}: AdminAuthGateProps) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleGoogleLogin() {
    setError(null);
    setSubmitting(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Не удалось выполнить вход';
      if (msg.includes('popup-closed-by-user')) {
        setError('Окно входа было закрыто до завершения авторизации.');
      } else if (msg.includes('popup-blocked')) {
        setError('Браузер заблокировал всплывающее окно. Разрешите всплывающие окна для сайта.');
      } else {
        setError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSwitchAccount() {
    setError(null);
    setSubmitting(true);
    try {
      await signOut(auth);
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сменить аккаунт');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#070709] text-zinc-100 relative overflow-x-clip flex flex-col items-center justify-center p-6">
      <OrangeFlowBackground />

      <div className="relative z-10 w-full max-w-md space-y-6">
        <button
          type="button"
          onClick={onBackToSite}
          className="inline-flex items-center gap-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Вернуться на сайт Layf1x-TOP
        </button>

        <div className="bg-[#121216]/90 backdrop-blur-md border border-zinc-800 rounded-xl p-8 space-y-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 text-xs font-medium text-orange-400">
              <ShieldCheck className="w-4 h-4" />
              <span>Layf1x-TOP · Админ-панель /admin</span>
            </div>
            <h1 className="font-display text-2xl font-bold text-white">
              Вход для тренера
            </h1>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Войдите через Google-аккаунт владельца, чтобы управлять общей облачной базой данных (синхронизируется мгновенно между компьютером и телефоном). Ученики по-прежнему входят по логину и паролю без Google.
            </p>
          </div>

          {accessDenied && currentUser && (
            <div className="p-3.5 bg-red-950/60 border border-red-900 rounded-lg text-xs text-red-200 space-y-1">
              <div className="font-semibold text-red-300">Нет прав администратора</div>
              <div>
                Вы вошли как <span className="font-mono-num text-white">{currentUser.email}</span>.
                Доступ открыт для аккаунта{' '}
                <span className="font-mono-num text-orange-300">{ADMIN_BOOTSTRAP_EMAIL}</span>.
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-950/60 border border-red-900 rounded-lg text-xs text-red-300">
              {error}
            </div>
          )}

          <div className="space-y-3">
            {accessDenied && currentUser ? (
              <>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleSwitchAccount}
                  className="w-full py-2.5 px-4 text-sm font-medium text-white bg-orange-600 hover:bg-orange-500 disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
                >
                  {submitting ? 'Выбор аккаунта...' : 'Войти под другим Google-аккаунтом'}
                </button>
                <button
                  type="button"
                  onClick={() => signOut(auth)}
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-medium text-zinc-300 hover:text-white border border-zinc-800 hover:border-zinc-700 rounded-lg transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Выйти из текущего аккаунта
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={submitting}
                onClick={handleGoogleLogin}
                className="w-full py-2.5 px-4 text-sm font-medium text-white bg-orange-600 hover:bg-orange-500 disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
              >
                {submitting ? 'Подключение...' : 'Войти через Google в /admin'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
