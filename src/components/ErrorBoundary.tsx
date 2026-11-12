import { Component, type ReactNode } from 'react';

/**
 * Last line of defence: if a screen crashes while drawing (for example on a record with an
 * unexpected shape), show a way back instead of a blank page.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error('[app] screen crashed', error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" style={{ maxWidth: 420, margin: '20vh auto', padding: 24, textAlign: 'center' }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Something went wrong</h1>
        <p style={{ marginBottom: 16 }}>This screen couldn’t be shown. Your saved entries are not affected.</p>
        <button type="button" onClick={() => window.location.reload()} style={{ padding: '10px 18px', minHeight: 44, borderRadius: 10, border: '1px solid currentColor' }}>
          Reload
        </button>
      </div>
    );
  }
}
