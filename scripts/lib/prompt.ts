/**
 * scripts/lib/prompt.ts
 *
 * Shared readline helper for interactive CLI scripts.
 */

import { createInterface } from 'readline';

/** Ask a single question on stdin and return the trimmed answer. */
export function ask(rl: ReturnType<typeof createInterface>, prompt: string): Promise<string> {
  return new Promise((resolve) => rl.question(prompt, resolve));
}
