// Keeps one thing that fails to draw from taking the whole app down with it.
import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode; fallback: ReactNode; onError?(): void; /** try again when this changes */ resetKey?: unknown }

export class ErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: unknown) { console.error(error); this.props.onError?.(); }
  componentDidUpdate(before: Props) { if (this.state.failed && before.resetKey !== this.props.resetKey) this.setState({ failed: false }); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}
