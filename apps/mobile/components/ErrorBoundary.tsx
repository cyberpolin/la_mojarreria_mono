import React from "react";
import { reportError } from "@/utils/errorLogger";

type FallbackProps = {
  error: Error;
  onRetry: () => void;
};

type Props = {
  children: React.ReactNode;
  FallbackComponent: React.ComponentType<FallbackProps>;
};

type State = {
  error: Error | null;
};

class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    reportError(error, {
      componentStack: info.componentStack ?? undefined,
      tags: { scope: "error_boundary" },
    });
  }

  handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    const { FallbackComponent, children } = this.props;

    if (error) {
      return <FallbackComponent error={error} onRetry={this.handleRetry} />;
    }

    return children;
  }
}

export default ErrorBoundary;
