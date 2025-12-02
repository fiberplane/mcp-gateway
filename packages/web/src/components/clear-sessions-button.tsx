/**
 * Clear Sessions Button Component
 *
 * Direct button to clear all captured sessions with confirmation.
 */

import { Trash2 } from "lucide-react";
import { Button } from "./ui/button";

interface ClearSessionsButtonProps {
  onClearSessions: () => void;
  isClearing?: boolean;
}

export function ClearSessionsButton({
  onClearSessions,
  isClearing = false,
}: ClearSessionsButtonProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClearSessions}
      disabled={isClearing}
    >
      <Trash2 className="h-4 w-4" aria-hidden="true" />
      {isClearing ? "Clearing..." : "Clear Sessions"}
    </Button>
  );
}
