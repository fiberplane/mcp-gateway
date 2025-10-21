export function TopNavigation() {
  return (
    <header className="bg-card border-b border-border">
      <div className="flex items-center justify-between px-6 py-6">
        {/* Logo container */}
        <div className="flex items-center gap-3">
          {/* Logo icon */}
          <svg
            width="19"
            height="15"
            viewBox="0 0 19 15"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="text-foreground"
            aria-label="Fiberplane logo"
          >
            <title>Fiberplane</title>
            <path d="M0 0H6.22689V6.22689H0V0Z" fill="currentColor" />
            <path
              d="M6.22656 0H12.4534V6.22689H6.22656V0Z"
              fill="currentColor"
              fillOpacity="0.6"
            />
            <path
              d="M12.4531 0H18.68V6.22689H12.4531V0Z"
              fill="currentColor"
              fillOpacity="0.3"
            />
            <path
              d="M0 8.31055H6.22689V14.5374H0V8.31055Z"
              fill="currentColor"
              fillOpacity="0.6"
            />
            <path
              d="M6.22656 8.31055H12.4534V14.5374H6.22656V8.31055Z"
              fill="currentColor"
              fillOpacity="0.3"
            />
          </svg>

          {/* Logo text */}
          <span className="text-base font-medium text-foreground">
            Fiberplane
          </span>
        </div>

        {/* Avatar - circular gradient placeholder */}
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500" />
      </div>
    </header>
  );
}
