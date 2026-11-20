import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error.message || 'Hitilafu isiyotarajiwa imetokea.',
    };
  }

  override render() {
    if (this.state.hasError) {
      let friendly = 'Kuna hitilafu ya muda imetokea. Tafadhali jaribu kupakia upya.';
      try {
        const parsed = JSON.parse(this.state.errorMessage) as { error?: string };
        if (parsed.error?.includes('Missing or insufficient permissions')) {
          friendly = 'Huna ruhusa ya kufanya kitendo hiki au muda wa kikao umeisha.';
        }
      } catch {
        // Keep friendly fallback
      }

      return (
        <div className="min-h-screen bg-white flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-2xl border border-[#E2E9E4] bg-[#F8FAF9] p-8 text-center">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-semibold text-[#13221B] mb-2">
              Samahani, kuna tatizo limejitokeza
            </h2>
            <p className="text-sm text-[#4A5D54] mb-6 leading-relaxed">{friendly}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#15623E] text-white text-sm font-medium hover:bg-[#114F32] transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Pakia Upya
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
