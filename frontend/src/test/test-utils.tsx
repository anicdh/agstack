/**
 * Test utilities — shared wrappers for rendering components in tests.
 *
 * USE: import { render, screen } from "@/test/test-utils" instead of @testing-library/react.
 * This wraps components with QueryClientProvider and other providers.
 *
 * @example
 * import { render, screen } from "@/test/test-utils";
 * render(<UserList />);
 * expect(screen.getByText("Users")).toBeInTheDocument();
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";

function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

interface WrapperProps {
  children: ReactNode;
}

function createWrapper(): ({ children }: WrapperProps) => ReactElement {
  const queryClient = createTestQueryClient();

  return function TestWrapper({ children }: WrapperProps): ReactElement {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

function customRender(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
) {
  return render(ui, { wrapper: createWrapper(), ...options });
}

// Re-export everything from testing-library
export * from "@testing-library/react";
export { customRender as render };
