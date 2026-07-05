export default function Nav() {
  return (
    <header className="sticky top-0 z-30 glass border-b border-line">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
        <a href="#top" className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent font-bold text-white">
            ?
          </span>
          <span className="font-medium tracking-tight">Un-doomed</span>
        </a>
        <div className="hidden items-center gap-8 text-sm text-muted md:flex">
          <a href="#how" className="transition-colors hover:text-ink">How it works</a>
          <a href="#downloads" className="transition-colors hover:text-ink">Downloads</a>
          <a href="#faq" className="transition-colors hover:text-ink">FAQ</a>
        </div>
        <a
          href="#downloads"
          className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-surface transition-colors hover:bg-accent hover:text-white"
        >
          Get started
        </a>
      </nav>
    </header>
  );
}
