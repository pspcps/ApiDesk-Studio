import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2, Copy, Check } from 'lucide-react';
import { reportClientLog } from '../utils/clientLogger';

export interface ErrorBoundaryProps {
  children: ReactNode;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false
    };
  }

  public static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error, errorInfo: null, copied: false };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Uncaught React Error:', error, errorInfo);
    this.setState({ errorInfo });
    reportClientLog('error', 'REACT_RENDER_CRASH', error.message || 'React render crash', {
      stack: error.stack,
      componentStack: errorInfo.componentStack
    });
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  private handleResetState = (): void => {
    if (window.confirm('Reset local workspace state to default? (This clears corrupted local cache)')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  private handleCopy = (): void => {
    const errorDetails = `${this.state.error?.toString()}\n\nStack:\n${this.state.errorInfo?.componentStack || this.state.error?.stack || 'N/A'}`;
    navigator.clipboard.writeText(errorDetails).then(() => {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    });
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div id="error-boundary-screen" className="min-h-screen w-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-2xl w-full bg-slate-900 border border-red-500/30 rounded-xl shadow-2xl p-6 flex flex-col gap-5">
            <div className="flex items-center gap-3 text-red-400">
              <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-white">Application Encountered an Error</h1>
                <p className="text-xs text-slate-400">ApiDesk prevented a crash. You can reload or reset the workspace below.</p>
              </div>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-4 font-mono text-xs text-red-300 overflow-x-auto max-h-56">
              <p className="font-semibold text-red-400">{this.state.error?.toString()}</p>
              {this.state.errorInfo?.componentStack && (
                <pre className="mt-2 text-slate-400 text-[11px] whitespace-pre-wrap">
                  {this.state.errorInfo.componentStack}
                </pre>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  id="error-copy-btn"
                  onClick={this.handleCopy}
                  className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {this.state.copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {this.state.copied ? 'Copied' : 'Copy Error Details'}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  id="error-reset-state-btn"
                  onClick={() => {
                    if (window.confirm('Reset local workspace state to default? (This clears corrupted local cache)')) {
                      localStorage.clear();
                      window.location.reload();
                    }
                  }}
                  className="px-3 py-1.5 text-xs font-medium bg-red-950/40 hover:bg-red-900/50 text-red-300 rounded-md border border-red-800/40 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Reset Corrupted Cache
                </button>
                <button
                  id="error-reload-btn"
                  onClick={this.handleReload}
                  className="px-4 py-1.5 text-xs font-medium bg-sky-600 hover:bg-sky-500 text-white rounded-md flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Reload Application
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
