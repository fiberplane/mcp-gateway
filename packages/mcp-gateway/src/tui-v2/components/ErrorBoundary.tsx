import { Component, type ReactNode } from "react";
import { debug } from "../debug";
import { useTheme } from "../theme-context";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: string | null;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error, errorInfo: null };
  }

  override componentDidCatch(
    error: Error,
    errorInfo: { componentStack: string },
  ): void {
    // Log the error to debug file
    debug("React Error Boundary caught error:", {
      error: error.toString(),
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });

    this.setState({
      errorInfo: errorInfo.componentStack,
    });
  }

  override render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} />;
    }

    return this.props.children;
  }
}

function ErrorFallback({ error }: { error: Error | null }) {
  const theme = useTheme();

  return (
    <box
      style={{
        flexDirection: "column",
        height: "100%",
        justifyContent: "center",
        alignItems: "center",
        padding: 4,
      }}
      backgroundColor={theme.background}
    >
      <box
        style={{
          flexDirection: "column",
          width: "80%",
          padding: 3,
        }}
        border={true}
        borderColor={theme.danger}
        title="Error"
        titleAlignment="center"
      >
        <text fg={theme.danger} style={{ marginBottom: 1 }}>
          Something went wrong!
        </text>

        <text fg={theme.foregroundMuted} style={{ marginBottom: 1 }}>
          {error?.message || "Unknown error"}
        </text>

        <text fg={theme.foregroundMuted} style={{ marginTop: 1 }}>
          Error details have been logged to tui-debug.log
        </text>

        <text fg={theme.foregroundMuted} style={{ marginTop: 2 }}>
          Press [q] to quit
        </text>
      </box>
    </box>
  );
}
