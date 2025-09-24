import type { FC } from "hono/jsx";

interface NavigationProps {
  currentPage?: "home" | "servers" | "add" | "events";
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
      {currentPage !== "events" && (
        <>
          <a href="/ui/events">Events</a>
          <span> | </span>
        </>
      )}
      {currentPage !== "add" && (
        <>
          <a href="/ui/add">Add Server</a>
          <span> | </span>
        </>
      )}
    </nav>
  );
};
