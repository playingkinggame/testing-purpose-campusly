import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';

interface State { crashed: boolean }

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { crashed: false };
  static getDerivedStateFromError(): State { return { crashed: true }; }
  componentDidCatch(error: Error, info: ErrInfo) { console.error('Campusly crashed:', error, info.componentStack); }
  render() {
    if (!this.state.crashed) return this.props.children;
    return (
      <div role="alert" className="flex min-h-screen items-center justify-center bg-cream p-6">
        <div className="glass max-w-md space-y-3 p-8 text-center">
          <h1 className="text-2xl font-bold text-forest">Oops, something broke</h1>
          <p className="text-sm text-muted">Don't worry, your data is safe. Reload the page to continue.</p>
          <Button onClick={() => { window.location.hash = '#/'; window.location.reload(); }}>Reload Campusly</Button>
        </div>
      </div>
    );
  }
}
type ErrInfo = ErrorInfo;
