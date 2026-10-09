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

/** 404 for an id the caller named; the entity name keeps the message specific without leaking internals. */
export class EntityNotFoundError extends AppError {
  constructor(entity: string, id: number) {
    super(404, ErrorCode.NotFound, `${entity} ${id} was not found.`);
  }
}

export class ForbiddenActionError extends AppError {
  constructor(message: string) {
    super(403, ErrorCode.Forbidden, message);
  }
}

export class DomainValidationError extends AppError {
  constructor(message: string, field?: string) {
    super(422, ErrorCode.ValidationError, message, field ? [{ field, message }] : undefined);
  }
}

/** A5a: a status change that the state machine does not allow. */
export class InvalidStateTransitionError extends AppError {
  constructor(from: string, to: string, allowed: readonly string[]) {
    super(
      409,
      ErrorCode.InvalidStateTransition,
      `A dispatch that is ${from} cannot move to ${to}.`,
      { from, to, allowed },
    );
  }
}

/** Error state "no team": the chosen team cannot take a new dispatch. */
export class TeamUnavailableError extends AppError {
  constructor(teamName: string) {
    super(422, ErrorCode.TeamUnavailable, `${teamName} is already on another dispatch.`);
  }
}

/** B3a: preview says the stock is not enough; the UI offers a resupply request. */
export class InsufficientStockError extends AppError {
  constructor(details: { resourceId: number; requested: number; available: number; unit: string }) {
    super(
      422,
      ErrorCode.InsufficientStock,
      `Only ${details.available} ${details.unit} available; ${details.requested} requested.`,
      { ...details, canRequestResupply: true },
    );
  }
}

/** B4a: stock changed between preview and confirm. Carries the current quantity. */
export class StaleStockError extends AppError {
  constructor(details: { resourceId: number; requested: number; currentQuantity: number }) {
    super(
      409,
      ErrorCode.StaleStock,
      `Stock changed since you previewed this allocation. ${details.currentQuantity} now available.`,
      details,
    );
  }
}

/** 3a / JOINT #9: destination shelter is full; list others, coordinator redirects. */
export class ShelterFullError extends AppError {
  constructor(shelterName: string, alternatives: unknown[]) {
    super(422, ErrorCode.ShelterFull, `${shelterName} is full.`, { alternatives });
  }
}

/** An allocation can be reversed once (unique index in migration 401), so a second attempt is a conflict, not a new entry. */
export class AlreadyReversedError extends AppError {
  constructor(allocationId: number) {
    super(409, ErrorCode.AlreadyReversed, `Allocation ${allocationId} was already reversed.`);
  }
}

export class NotReversibleError extends AppError {
  constructor(allocationId: number) {
    super(
      422,
      ErrorCode.NotReversible,
      `Entry ${allocationId} is a reversal itself and cannot be reversed.`,
    );
  }
}
