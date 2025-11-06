import { AlertCircle } from "lucide-react";
import { Button } from "./button";

interface ErrorAlertProps {
  error: Error | string;
  title?: string;
  retry?: () => void;
  details?: boolean;
}

/**
 * Unified error alert component for consistent error presentation
 * Used across the application for displaying errors
 */
export function ErrorAlert({
  error,
  title = "Something went wrong",
  retry,
  details = import.meta.env.DEV,
}: ErrorAlertProps) {
  const errorMessage = typeof error === "string" ? error : error.message;

  return (
    <div
      className="p-4 bg-destructive/10 border border-destructive/20 rounded-md text-destructive"
      role="alert"
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <p className="font-medium">{title}</p>
          <p className="text-sm mt-1">{errorMessage}</p>
          {retry && (
            <Button
              onClick={retry}
              size="sm"
              variant="outline"
              className="mt-3"
            >
              Try Again
            </Button>
          )}
          {details && typeof error !== "string" && (
            <details className="mt-2 text-xs">
              <summary className="cursor-pointer">Error details</summary>
              <pre className="mt-1 overflow-auto whitespace-pre-wrap break-words">
                {error.stack || error.message}
              </pre>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
