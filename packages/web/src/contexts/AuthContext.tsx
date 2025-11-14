/**
 * Auth Context for shared authentication state
 *
 * Provides token and auth error state throughout the component tree.
 * Prevents duplicate useState instances when useAuth is called multiple times.
 */

import { useQueryState } from "nuqs";
import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useState } from "react";
import { UnauthorizedError } from "../lib/errors.js";

interface AuthContextValue {
  token: string | null;
  hasAuthError: boolean;
  setHasAuthError: (value: boolean) => void;
  isUnauthorizedError: (error: unknown) => error is UnauthorizedError;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Provider component that supplies auth state to the component tree
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [tokenFromUrl] = useQueryState("token");
  const [hasAuthError, setHasAuthError] = useState(false);

  // Reset auth error when token changes
  useEffect(() => {
    if (tokenFromUrl) {
      setHasAuthError(false);
    }
  }, [tokenFromUrl]);

  // Type guard for unauthorized errors
  const isUnauthorizedError = (error: unknown): error is UnauthorizedError => {
    return error instanceof UnauthorizedError;
  };

  const value = {
    token: tokenFromUrl,
    hasAuthError,
    setHasAuthError,
    isUnauthorizedError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to access auth state from context
 *
 * @throws Error if used outside AuthProvider
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
