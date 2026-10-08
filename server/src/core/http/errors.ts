import { ErrorCode, type FieldError } from '@dms/shared';

/** Base class for every error that should reach the client as a structured response. */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: FieldError[]) {
    super(400, ErrorCode.ValidationError, message, details);
  }
}

export class UnauthenticatedError extends AppError {
  constructor(message = 'Authentication is required.') {
    super(401, ErrorCode.Unauthenticated, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action.') {
    super(403, ErrorCode.Forbidden, message);
  }
}

export class NotFoundError extends AppError {
  constructor(what: string) {
    super(404, ErrorCode.NotFound, `${what} was not found.`);
  }
}

/** The requested transition is not allowed from the current state (HTTP 409). */
export class InvalidStateError extends AppError {
  constructor(message: string) {
    super(409, ErrorCode.InvalidStateTransition, message);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: unknown) {
    super(409, ErrorCode.Conflict, message, details);
  }
}

/** Request is well-formed but breaks a business rule (HTTP 422). */
export class UnprocessableError extends AppError {
  constructor(code: string, message: string, details?: unknown) {
    super(422, code, message, details);
  }
}
