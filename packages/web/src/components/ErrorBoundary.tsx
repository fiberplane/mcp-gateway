import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, errorInfo: ErrorInfo) => ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary component to catch and handle React errors
 *
 * Prevents the entire app from crashing when a component throws an error.
 * Displays a fallback UI with error details.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({
      error,
      errorInfo,
    });
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // Type guards ensure error and errorInfo are available when hasError is true
      const { error, errorInfo } = this.state;
      if (!error || !errorInfo) {
        return null;
      }

      if (this.props.fallback) {
        return this.props.fallback(error, errorInfo);
      }

      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-6">
            <h1 className="text-2xl font-bold text-red-600 mb-4">
              Something went wrong
            </h1>
            <p className="text-gray-700 mb-4">
              The application encountered an error. Please refresh the page to
              try again.
            </p>
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-medium text-gray-600 hover:text-gray-900">
                Error details
              </summary>
              <div className="mt-2 p-4 bg-gray-50 rounded border border-gray-200">
                <p className="text-sm font-mono text-red-600">
                  {error.toString()}
                </p>
                {errorInfo.componentStack && (
                  <pre className="mt-2 text-xs text-gray-600 overflow-auto">
                    {errorInfo.componentStack}
                  </pre>
                )}
              </div>
            </details>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
