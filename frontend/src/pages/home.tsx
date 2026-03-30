/**
 * Home page — placeholder for Phase A.
 *
 * Replace with actual dashboard/landing in Phase B.
 */

export function HomePage(): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-16">
      <h1 className="text-4xl font-bold tracking-tight">__PROJECT_NAME__</h1>
      <p className="max-w-md text-center text-muted-foreground">
        Project is up and running. Run <code className="rounded bg-muted px-1.5 py-0.5 text-sm">/office-hours</code> to
        start planning your product.
      </p>
      <div className="flex gap-4">
        <a
          href="/api/docs"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          API Docs (Swagger)
        </a>
      </div>
    </div>
  );
}
