import { AppError } from '../../core/http/errors';

/** Module error codes (never reused for a different meaning — plan §3.6). */
export const ErrorCode = {
  NotFound: 'NOT_FOUND',
  Forbidden: 'FORBIDDEN',
  ValidationError: 'VALIDATION_ERROR',
  InvalidStateTransition: 'INVALID_STATE_TRANSITION',
  TeamUnavailable: 'TEAM_UNAVAILABLE',
  InsufficientStock: 'INSUFFICIENT_STOCK',
  StaleStock: 'STALE_STOCK',
  ShelterFull: 'SHELTER_FULL',
  AlreadyReversed: 'ALREADY_REVERSED',
  NotReversible: 'NOT_REVERSIBLE',
} as const;

export class EntityNotFoundError extends AppError {
  constructor(entity: string, id: number) {
    super(ErrorCode.NotFound, 404, `${entity} ${id} was not found.`);
  }
}

export class ForbiddenActionError extends AppError {
  constructor(message: string) {
    super(ErrorCode.Forbidden, 403, message);
  }
}

export class DomainValidationError extends AppError {
  constructor(message: string, field?: string) {
    super(ErrorCode.ValidationError, 422, message, field ? [{ field, message }] : undefined);
  }
}

/** A5a: a status change that the state machine does not allow. */
export class InvalidStateTransitionError extends AppError {
  constructor(from: string, to: string, allowed: readonly string[]) {
    super(
      ErrorCode.InvalidStateTransition,
      409,
      `A dispatch that is ${from} cannot move to ${to}.`,
      { from, to, allowed },
    );
  }
}

/** Error state "no team": the chosen team cannot take a new dispatch. */
export class TeamUnavailableError extends AppError {
  constructor(teamName: string) {
    super(ErrorCode.TeamUnavailable, 422, `${teamName} is already on another dispatch.`);
  }
}

/** B3a: preview says the stock is not enough; the UI offers a resupply request. */
export class InsufficientStockError extends AppError {
  constructor(details: {
    resourceId: number;
    requested: number;
    available: number;
    unit: string;
  }) {
    super(
      ErrorCode.InsufficientStock,
      422,
      `Only ${details.available} ${details.unit} available; ${details.requested} requested.`,
      { ...details, canRequestResupply: true },
    );
  }
}

/** B4a: stock changed between preview and confirm. Carries the current quantity. */
export class StaleStockError extends AppError {
  constructor(details: { resourceId: number; requested: number; currentQuantity: number }) {
    super(
      ErrorCode.StaleStock,
      409,
      `Stock changed since you previewed this allocation. ${details.currentQuantity} now available.`,
      details,
    );
  }
}

/** 3a / JOINT #9: destination shelter is full; list others, coordinator redirects. */
export class ShelterFullError extends AppError {
  constructor(shelterName: string, alternatives: unknown[]) {
    super(ErrorCode.ShelterFull, 422, `${shelterName} is full.`, { alternatives });
  }
}

export class AlreadyReversedError extends AppError {
  constructor(allocationId: number) {
    super(ErrorCode.AlreadyReversed, 409, `Allocation ${allocationId} was already reversed.`);
  }
}

export class NotReversibleError extends AppError {
  constructor(allocationId: number) {
    super(
      ErrorCode.NotReversible,
      422,
      `Entry ${allocationId} is a reversal itself and cannot be reversed.`,
    );
  }
}
