import { Component, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';

interface Props { children: ReactNode }
interface State { error: Error | null }

export class PageBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State { return { error }; }

  render() {
    if (this.state.error) {
      return (
        <div className="mx-auto max-w-lg py-16 text-center">
          <h1 className="text-xl font-bold text-forest">This page hit a problem</h1>
          <p className="mt-2 text-sm text-muted">Try reloading. If it keeps happening, go back to the home screen.</p>
          <div className="mt-4 flex justify-center gap-2">
            <Button onClick={() => window.location.reload()}>Reload</Button>
            <Button variant="ghost" onClick={() => { window.location.hash = '#/'; window.location.reload(); }}>Go home</Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
