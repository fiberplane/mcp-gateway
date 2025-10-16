import { useHandler } from "../lib/use-handler";
import { Button } from "./ui/button";

interface PaginationProps {
  hasMore: boolean;
  onLoadMore: () => void;
  isLoading?: boolean;
}

export function Pagination({
  hasMore,
  onLoadMore,
  isLoading,
}: PaginationProps) {
  const handleClick = useHandler(() => {
    onLoadMore();
  });

  if (!hasMore) {
    return null;
  }

  return (
    <div className="mt-5 text-center">
      <Button
        type="button"
        onClick={handleClick}
        disabled={isLoading}
        variant="outline"
      >
        {isLoading ? "Loading..." : "Load More"}
      </Button>
    </div>
  );
}
