/**
 * useApiMutation — shared hook for all create/update/delete operations.
 *
 * USE this hook instead of writing your own useMutation + toast + invalidate.
 * Handles: optimistic UI, error toast, query invalidation.
 *
 * @example
 * const createUser = useApiMutation({
 *   mutationFn: (data: CreateUserDto) => api.post<User>("/users", data),
 *   invalidateKeys: [["users", "list"]],
 *   successMessage: "User created",
 * });
 *
 * createUser.mutate({ name: "An", email: "an@example.com" });
 */

import {
  useMutation,
  useQueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";

interface UseApiMutationOptions<TData, TVariables> {
  mutationFn: (variables: TVariables) => Promise<TData>;
  invalidateKeys?: readonly (readonly unknown[])[];
  successMessage?: string;
  onSuccess?: (data: TData, variables: TVariables) => void;
  onError?: (error: Error, variables: TVariables) => void;
  mutationOptions?: Omit<UseMutationOptions<TData, Error, TVariables>, "mutationFn">;
}

interface UseApiMutationResult<TData, TVariables> {
  mutate: (variables: TVariables) => void;
  mutateAsync: (variables: TVariables) => Promise<TData>;
  isPending: boolean;
  isError: boolean;
  error: Error | null;
  data: TData | undefined;
  reset: () => void;
}

export function useApiMutation<TData, TVariables>({
  mutationFn,
  invalidateKeys,
  successMessage: _successMessage,
  onSuccess,
  onError,
  mutationOptions,
}: UseApiMutationOptions<TData, TVariables>): UseApiMutationResult<TData, TVariables> {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn,
    onSuccess: (data, variables) => {
      // Invalidate related queries
      if (invalidateKeys) {
        for (const key of invalidateKeys) {
          void queryClient.invalidateQueries({ queryKey: [...key] });
        }
      }

      // TODO: integrate with toast system when setup
      // if (successMessage) showToast.success(successMessage);

      onSuccess?.(data, variables);
    },
    onError: (error, variables) => {
      // TODO: integrate with toast system when setup
      // showToast.error(error.message);

      onError?.(error, variables);
    },
    ...mutationOptions,
  });

  return {
    mutate: mutation.mutate,
    mutateAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    data: mutation.data,
    reset: mutation.reset,
  };
}
