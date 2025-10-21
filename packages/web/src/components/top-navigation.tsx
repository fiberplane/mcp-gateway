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
            className="text-foreground shrink-0"
            aria-label="Fiberplane logo"
          >
            <title>Fiberplane</title>
            <path
              d="M0 4.7832V7.17005L9.24092 7.189L9.78614 4.80215L0 4.7832Z"
              fill="currentColor"
            />
            <path
              d="M0 0V2.38685L10.3314 2.40579L10.4238 1.98904C10.6548 0.985049 9.91551 0.0189432 8.90825 0.0189432L0 0Z"
              fill="currentColor"
            />
            <path
              d="M8.68359 9.57582L9.22881 7.18896L15.0783 7.19844L14.2189 9.58529L8.68359 9.57582Z"
              fill="currentColor"
            />
            <path
              d="M9.7793 4.80149L10.3338 2.41465L18.6691 2.38623L17.6895 4.76361L9.7793 4.80149Z"
              fill="currentColor"
            />
            <path
              d="M0 9.55518V11.942L8.14125 11.961L8.68647 9.57412L0 9.55518Z"
              fill="currentColor"
            />
            <path
              d="M11.613 14.3573H9.92189C8.70209 14.3573 7.81496 13.1638 8.12915 11.9609H12.5463L11.613 14.3573Z"
              fill="currentColor"
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
