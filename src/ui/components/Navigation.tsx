import type { FC } from "hono/jsx";

interface NavigationProps {
  currentPage?: "home" | "servers" | "add";
}

export const Navigation: FC<NavigationProps> = ({ currentPage }) => {
  return (
    <nav>
      {currentPage !== "home" && (
        <>
          <a href="/ui">← Home</a>
          <span> | </span>
        </>
      )}
      {currentPage !== "servers" && (
        <>
          <a href="/ui/servers">Servers</a>
          <span> | </span>
        </>
      )}
      {currentPage !== "add" && (
        <>
          <a href="/ui/add">Add Server</a>
          <span> | </span>
        </>
      )}
      <a href="/status">API Status</a>
      <span> | </span>
      <a href="/">Gateway Info</a>
    </nav>
  );
};
