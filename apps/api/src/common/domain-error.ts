export type DomainErrorCode = 'not_found' | 'conflict' | 'invalid' | 'unavailable';

/** Business-rule failure; mapped to an HTTP status by DomainExceptionFilter. */
export class DomainError extends Error {
  constructor(
    readonly code: DomainErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export const notFound = (what: string) => new DomainError('not_found', `${what} not found`);
export const conflict = (message: string) => new DomainError('conflict', message);
export const invalid = (message: string) => new DomainError('invalid', message);
export const unavailable = (message: string) => new DomainError('unavailable', message);

export function orNotFound<T>(value: T | null | undefined, what: string): T {
  if (value == null) throw notFound(what);
  return value;
}

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));
