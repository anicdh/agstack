/**
 * App layout — shared header + content area.
 *
 * Minimal shell for Phase A. Sidebar, nav, auth UI added in Phase B
 * based on product decisions from /office-hours.
 */

import { Outlet } from "react-router-dom";

export function Layout(): React.JSX.Element {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex h-14 items-center px-4">
          <span className="text-lg font-semibold">__PROJECT_NAME__</span>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
