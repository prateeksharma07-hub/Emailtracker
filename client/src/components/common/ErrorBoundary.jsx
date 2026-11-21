import React, { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * ErrorBoundary — Catches render-time JavaScript exceptions in React component subtrees.
 * 
 * Prevents application-wide White Screen of Death (blank screen).
 * Strictly logs only error name, message, and component stack trace to console.
 * NEVER logs email bodies, user content, or sensitive session tokens.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error, errorInfo) {
    // Defense-in-depth: Log only sanitized error metadata without user email payloads
    console.error('[ErrorBoundary caught error]', {
      name: error?.name,
      message: error?.message,
      componentStack: errorInfo?.componentStack
    });

    if (this.props.onError) {
      try {
        this.props.onError(error, errorInfo);
      } catch (e) {
        // Ignore secondary callback errors
      }
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null
    });
    if (this.props.onReset) {
      try {
        this.props.onReset();
      } catch (e) {
        // Ignore secondary callback errors
      }
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return typeof this.props.fallback === 'function'
          ? this.props.fallback({ error: this.state.error, reset: this.handleReset })
          : this.props.fallback;
      }

      const viewLabel = this.props.viewName || 'Screen';

      return (
        <div className="min-h-[320px] flex items-center justify-center p-6 animate-fade-in font-sans">
          <div className="max-w-lg w-full glass-card rounded-3xl p-8 border border-rose-500/30 bg-rose-950/10 dark:bg-rose-950/20 text-center space-y-5 shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center mx-auto text-rose-500 shadow-lg shadow-rose-500/10">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                Kuch galat hua / Something went wrong
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {viewLabel} ko render karte waqt ek anpekshit error aaya. Baaki application surakshit hai.
              </p>
            </div>

            {this.state.error?.message && (
              <div className="p-3 rounded-xl bg-slate-900/80 text-rose-300 font-mono text-[11px] text-left overflow-x-auto border border-rose-900/50">
                <p className="font-bold opacity-75 mb-0.5">Diagnostic Signal:</p>
                <p className="break-words">{this.state.error.message}</p>
              </div>
            )}

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={this.handleReset}
                className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Try Again (Dobaara Koshish Karein)</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
