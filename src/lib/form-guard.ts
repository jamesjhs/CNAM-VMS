/**
 * In-memory submission tracking to prevent concurrent/duplicate form submissions.
 * This is a simple client-side guard; server-side idempotency keys are recommended for critical operations.
 */
const activeSubmissions = new Map<string, Promise<any>>();

/**
 * Guard a form submission to prevent concurrent duplicate submissions.
 * If a submission with the same key is already in progress, returns the existing promise.
 * Otherwise, executes the handler and tracks it until completion.
 *
 * Usage:
 *   const result = await guardSubmission('myForm', async () => {
 *     return await myAsyncAction();
 *   });
 */
export async function guardSubmission<T>(
  key: string,
  handler: () => Promise<T>,
): Promise<T> {
  const existing = activeSubmissions.get(key);
  if (existing) {
    return existing;
  }

  // Delete the entry BEFORE executing handler to prevent rejected promise reuse
  // If handler throws/rejects, we'll not be returning a stale rejected promise on retry
  const promise = handler()
    .catch((err) => {
      // Error case: clean up and re-throw
      activeSubmissions.delete(key);
      throw err;
    })
    .then((result) => {
      // Success case: clean up and return result
      activeSubmissions.delete(key);
      return result;
    });

  activeSubmissions.set(key, promise);
  return promise;
}

/**
 * Check if a submission is currently in progress.
 */
export function isSubmitting(key: string): boolean {
  return activeSubmissions.has(key);
}

/**
 * Cancel a pending submission (if it exists).
 * Note: This doesn't actually stop the async operation, just clears tracking.
 */
export function clearSubmission(key: string): void {
  activeSubmissions.delete(key);
}
