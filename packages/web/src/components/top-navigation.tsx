import { FiberplaneLogo } from "./fiberplane-logo";

export function TopNavigation() {
  return (
    <header className="bg-card border-b border-border">
      <div className="flex items-center px-6 py-6">
        {/* Logo container */}
        <div className="flex items-center gap-3">
          <FiberplaneLogo className="text-foreground shrink-0" />
          <span className="text-base font-medium text-foreground">
            Fiberplane
          </span>
        </div>
      </div>
    </header>
  );
}
