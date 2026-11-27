import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let readable = 'Произошла непредвиденная ошибка при работе с базой данных.';
    try {
      const parsed = JSON.parse(error.message) as { error?: string };
      if (parsed && typeof parsed.error === 'string') {
        if (parsed.error.toLowerCase().includes('permission')) {
          readable = 'Недостаточно прав для выполнения этого действия. Проверьте вход в аккаунт.';
        } else {
          readable = parsed.error;
        }
      }
    } catch {
      if (error.message) readable = error.message;
    }
    return { hasError: true, message: readable };
  }

  componentDidCatch(error: Error) {
    console.error('App ErrorBoundary caught:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#070709] text-zinc-100 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-[#121216] border border-zinc-800 rounded-2xl p-8 text-center space-y-4">
            <div className="w-12 h-12 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6 text-orange-400" />
            </div>
            <h1 className="font-display text-xl font-bold text-white">
              Ошибка загрузки Layf1x-TOP
            </h1>
            <p className="text-sm text-zinc-400 leading-relaxed">{this.state.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-orange-600 hover:bg-orange-500 rounded-lg cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              Обновить страницу
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
