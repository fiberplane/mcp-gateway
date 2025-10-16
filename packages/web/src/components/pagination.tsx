import { useHandler } from "../lib/use-handler";

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
    <div
      style={{
        marginTop: "20px",
        textAlign: "center",
      }}
    >
      <button
        type="button"
        onClick={handleClick}
        disabled={isLoading}
        style={{
          padding: "10px 24px",
          fontSize: "14px",
          fontWeight: 500,
        }}
      >
        {isLoading ? "Loading..." : "Load More"}
      </button>
    </div>
  );
}
