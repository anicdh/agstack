/**
 * App router — defines all routes.
 *
 * Start with home + 404. Add feature routes in Phase B.
 * Each feature should lazy-load its pages for code splitting.
 */

import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./layout";
import { HomePage } from "@/pages/home";

function NotFound(): React.JSX.Element {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-muted-foreground">Page not found.</p>
      <a href="/" className="text-primary underline">
        Go home
      </a>
    </div>
  );
}

export function Router(): React.JSX.Element {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
