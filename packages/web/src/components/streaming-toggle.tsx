import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";

interface StreamingToggleProps {
  isStreaming: boolean;
  onToggle: (enabled: boolean) => void;
}

export function StreamingToggle({
  isStreaming,
  onToggle,
}: StreamingToggleProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <span className="text-sm font-medium text-muted-foreground">
        Streaming:
      </span>
      <div className="flex gap-1">
        <Button
          variant={isStreaming ? "default" : "ghost"}
          size="sm"
          onClick={() => onToggle(!isStreaming)}
          className="gap-2 relative cursor-pointer"
        >
          <Activity
            className={cn(
              "w-4 h-4",
              isStreaming
                ? "text-green-500 motion-safe:animate-pulse"
                : "text-muted-foreground",
            )}
          />
          {isStreaming ? "ON" : "OFF"}
        </Button>
      </div>
    </div>
  );
}
