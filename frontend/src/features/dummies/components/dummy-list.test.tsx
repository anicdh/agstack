/**
 * DummyList component tests — REFERENCE test file.
 *
 * THIS IS A REFERENCE IMPLEMENTATION for the boilerplate.
 * Use this as a pattern when writing tests for new components.
 * Run `npm run scaffold:clean` to remove all Dummies code.
 *
 * PATTERN for component tests:
 * 1. Use render from @/test/test-utils (includes QueryClientProvider)
 * 2. Mock API calls via vi.mock on the queries file
 * 3. Test: loading state, data rendering, empty state, error state
 * 4. Test user interactions (search, pagination, actions)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@/test/test-utils";
import { DummyList } from "./dummy-list";

// Mock the query hooks
const mockUseDummies = vi.fn();
const mockUseDeleteDummy = vi.fn();

vi.mock("../queries/use-dummies", () => ({
  useDummies: (...args: unknown[]) => mockUseDummies(...args),
  useDeleteDummy: () => mockUseDeleteDummy(),
}));

const mockOnEdit = vi.fn();

const sampleDummies = [
  {
    id: "dummy-1",
    name: "Alpha One",
    email: "alpha1@example.com",
    status: "ACTIVE",
    category: "ALPHA",
    description: "First alpha dummy",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "dummy-2",
    name: "Beta Two",
    email: "beta2@example.com",
    status: "INACTIVE",
    category: "BETA",
    description: null,
    createdAt: "2024-01-02T00:00:00Z",
    updatedAt: "2024-01-02T00:00:00Z",
  },
];

describe("DummyList", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseDeleteDummy.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });
  });

  it("renders loading skeleton when data is loading", () => {
    mockUseDummies.mockReturnValue({
      data: [],
      meta: undefined,
      page: 1,
      isLoading: true,
      isError: false,
      error: null,
      hasNextPage: false,
      hasPrevPage: false,
      nextPage: vi.fn(),
      prevPage: vi.fn(),
    });

    render(<DummyList onEdit={mockOnEdit} />);

    expect(screen.getByLabelText("Loading dummies")).toBeInTheDocument();
  });

  it("renders dummy data in table rows", () => {
    mockUseDummies.mockReturnValue({
      data: sampleDummies,
      meta: { total: 2, page: 1, limit: 20, totalPages: 1 },
      page: 1,
      isLoading: false,
      isError: false,
      error: null,
      hasNextPage: false,
      hasPrevPage: false,
      nextPage: vi.fn(),
      prevPage: vi.fn(),
    });

    render(<DummyList onEdit={mockOnEdit} />);

    expect(screen.getByText("Alpha One")).toBeInTheDocument();
    expect(screen.getByText("beta2@example.com")).toBeInTheDocument();
    expect(screen.getByText("2 items total")).toBeInTheDocument();
  });

  it("renders status and category badges correctly", () => {
    mockUseDummies.mockReturnValue({
      data: sampleDummies,
      meta: { total: 2, page: 1, limit: 20, totalPages: 1 },
      page: 1,
      isLoading: false,
      isError: false,
      error: null,
      hasNextPage: false,
      hasPrevPage: false,
      nextPage: vi.fn(),
      prevPage: vi.fn(),
    });

    render(<DummyList onEdit={mockOnEdit} />);

    expect(screen.getByText("ACTIVE")).toBeInTheDocument();
    expect(screen.getByText("INACTIVE")).toBeInTheDocument();
    expect(screen.getByText("ALPHA")).toBeInTheDocument();
    expect(screen.getByText("BETA")).toBeInTheDocument();
  });

  it("renders empty state when no dummies found", () => {
    mockUseDummies.mockReturnValue({
      data: [],
      meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
      page: 1,
      isLoading: false,
      isError: false,
      error: null,
      hasNextPage: false,
      hasPrevPage: false,
      nextPage: vi.fn(),
      prevPage: vi.fn(),
    });

    render(<DummyList onEdit={mockOnEdit} />);

    expect(screen.getByText("No dummies found.")).toBeInTheDocument();
  });

  it("renders error state with message", () => {
    mockUseDummies.mockReturnValue({
      data: [],
      meta: undefined,
      page: 1,
      isLoading: false,
      isError: true,
      error: new Error("Network error"),
      hasNextPage: false,
      hasPrevPage: false,
      nextPage: vi.fn(),
      prevPage: vi.fn(),
    });

    render(<DummyList onEdit={mockOnEdit} />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/Network error/)).toBeInTheDocument();
  });

  it("renders category filter dropdown", () => {
    mockUseDummies.mockReturnValue({
      data: sampleDummies,
      meta: { total: 2, page: 1, limit: 20, totalPages: 1 },
      page: 1,
      isLoading: false,
      isError: false,
      error: null,
      hasNextPage: false,
      hasPrevPage: false,
      nextPage: vi.fn(),
      prevPage: vi.fn(),
    });

    render(<DummyList onEdit={mockOnEdit} />);

    expect(screen.getByLabelText("Filter by category")).toBeInTheDocument();
  });
});
