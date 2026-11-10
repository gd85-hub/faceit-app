import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";

type SiteHeaderProps = {
  showNewComparison?: boolean;
};

export function SiteHeader({ showNewComparison = false }: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-40 h-14 border-b border-[var(--border)] bg-[var(--bg)] backdrop-blur">
      <div className="mx-auto flex h-full max-w-5xl items-center justify-between gap-4 px-4">
        <div className="flex min-w-0 items-center gap-4">
          <Link
            href="/"
            className="shrink-0 text-sm font-semibold tracking-tight text-[var(--text)] focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--text)]"
          >
            FACEIT <span className="font-mono text-[var(--accent)]">CS2</span>{" "}
            Compare
          </Link>
          <Link
            href="/progress"
            className="shrink-0 text-sm text-[var(--text-dim)] transition-colors hover:text-[var(--text)] focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--text)]"
          >
            Progress
          </Link>
          {showNewComparison ? (
            <Link
              href="/"
              className="truncate text-sm text-[var(--text-dim)] transition-colors hover:text-[var(--text)] focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--text)]"
            >
              {"\u2190"} New comparison
            </Link>
          ) : null}
        </div>
        <ThemeToggle />
      </div>
    </header>
  );
}
