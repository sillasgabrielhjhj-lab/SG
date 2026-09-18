function Logo() {
  return (
    <a href="#home" className="flex items-center gap-2">
      <svg
        width="28"
        height="28"
        viewBox="0 0 100 100"
        fill="none"
        aria-hidden="true"
        className="shrink-0"
      >
        <path
          d="M68 12 C42 12 24 30 24 54 C24 78 42 92 64 92 L64 62 L44 62"
          stroke="url(#logo-gradient)"
          strokeWidth="11"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <path
          d="M40 46 L28 54 L40 62 M56 46 L68 54 L56 62"
          stroke="#3b82f6"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <defs>
          <linearGradient id="logo-gradient" x1="24" y1="12" x2="68" y2="92">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#ffffff" />
          </linearGradient>
        </defs>
      </svg>
      <span
        className="text-3xl tracking-tight text-foreground"
        style={{ fontFamily: "'Instrument Serif', serif" }}
      >
        Gabrieldev
        <span className="text-[#3b82f6]">.sites</span>
      </span>
    </a>
  )
}

export default Logo
