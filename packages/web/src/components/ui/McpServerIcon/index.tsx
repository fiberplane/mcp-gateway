import type { MarketplaceServer } from "@/lib/marketplace-data";
import { cn } from "@/lib/utils";
import AstroIcon from "./astro.svg?react";
import Context7Icon from "./context7.svg?react";
import FigmaIcon from "./figma.svg?react";
import GithubIcon from "./github.svg?react";
import LinearIcon from "./linear.svg?react";
import McpIcon from "./mcp.svg?react";
import NeonIcon from "./neon.svg?react";
import NotionIcon from "./notion.svg?react";
import PlaywrightIcon from "./playwright.svg?react";
import PrismaIcon from "./prisma.svg?react";
import ShadcnIcon from "./shadcn-ui.svg?react";

interface McpServerIconProps {
  server: MarketplaceServer;
  className?: string;
}

export function McpServerIcon({ server, className }: McpServerIconProps) {
  const icon = server.icon ?? "mcp";

  return (
    <div
      className={cn(
        "flex-shrink-0 w-12 h-12 rounded-md border border-border bg-card flex items-center justify-center text-2xl",
        className,
      )}
    >
      <Icon icon={icon} />
    </div>
  );
}

function Icon({ icon }: { icon: string }) {
  if (icon === "playwright") {
    return <PlaywrightIcon className="w-8 h-8" />;
  }

  if (icon === "linear") {
    return <LinearIcon className="w-8 h-8" />;
  }

  if (icon === "notion") {
    return <NotionIcon className="w-8 h-8" />;
  }

  if (icon === "github") {
    return <GithubIcon className="w-8 h-8" />;
  }

  if (icon === "figma") {
    return <FigmaIcon className="w-8 h-8" />;
  }

  if (icon === "context7") {
    return <Context7Icon className="w-8 h-8" />;
  }

  if (icon === "neon") {
    return <NeonIcon className="w-8 h-8" />;
  }

  if (icon === "shadcn") {
    return <ShadcnIcon className="w-8 h-8" />;
  }

  if (icon === "prisma") {
    return <PrismaIcon className="w-8 h-8" />;
  }

  if (icon === "astro") {
    return <AstroIcon className="w-8 h-8" />;
  }

  // if (icon === "mcp") {
  return <McpIcon className="w-8 h-8" />;
  // }

  // return icon;
}
