import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { ServerErrorPage } from '../pages/ServerErrorPage';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  failed: boolean;
}

/** Catches a crash while a page renders and shows the 500 page in its place, keeping the header and footer. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Page failed to render', error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.failed) return <ServerErrorPage onRetry={() => this.setState({ failed: false })} />;
    return this.props.children;
  }
}
