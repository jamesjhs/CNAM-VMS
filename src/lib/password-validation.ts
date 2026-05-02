/**
 * Shared password validation utilities used across all password flows.
 * Ensures consistent password complexity requirements:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one digit
 * - At least one special character (@$!%*?&)
 */

export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/;

export const MIN_PASSWORD_LENGTH = 8;

/**
 * Validate that a password meets complexity requirements.
 * Returns null if valid, otherwise returns error code for redirect.
 */
export function validatePasswordComplexity(password: string): string | null {
  if (!password) {
    return 'MissingPassword';
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return 'TooShort';
  }

  if (!PASSWORD_REGEX.test(password)) {
    return 'WeakPassword';
  }

  return null;
}

/**
 * Get a human-readable error message for password validation errors.
 */
export function getPasswordErrorMessage(errorCode: string): string {
  const messages: Record<string, string> = {
    MissingPassword: 'Password is required',
    TooShort: 'Password must be at least 8 characters',
    WeakPassword:
      'Password must contain uppercase, lowercase, digit, and special character (@$!%*?&)',
  };
  return messages[errorCode] || 'Invalid password';
}
