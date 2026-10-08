import { useId } from 'react';
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';

interface FieldFrameProps {
  label: string;
  hint?: string;
  error?: string;
  children: (ids: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode;
}

/** Label above, control, then hint/error below — wired for screen readers (the team plan §3.13). */
function FieldFrame({ label, hint, error, children }: FieldFrameProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint && (
        <span className="field__hint" id={hintId}>
          {hint}
        </span>
      )}
      {error && (
        <span className="field__error" id={errorId} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
}

export function TextInput({
  label,
  hint,
  error,
  ...rest
}: FieldProps & Omit<InputHTMLAttributes<HTMLInputElement>, 'id'>) {
  return (
    <FieldFrame label={label} hint={hint} error={error}>
      {({ id, describedBy, invalid }) => (
        <input
          {...rest}
          id={id}
          className="control"
          aria-invalid={invalid}
          aria-describedby={describedBy}
        />
      )}
    </FieldFrame>
  );
}

export function TextArea({
  label,
  hint,
  error,
  ...rest
}: FieldProps & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'>) {
  return (
    <FieldFrame label={label} hint={hint} error={error}>
      {({ id, describedBy, invalid }) => (
        <textarea
          {...rest}
          id={id}
          className="control"
          aria-invalid={invalid}
          aria-describedby={describedBy}
        />
      )}
    </FieldFrame>
  );
}

export function Select({
  label,
  hint,
  error,
  children,
  ...rest
}: FieldProps & Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'>) {
  return (
    <FieldFrame label={label} hint={hint} error={error}>
      {({ id, describedBy, invalid }) => (
        <select
          {...rest}
          id={id}
          className="control"
          aria-invalid={invalid}
          aria-describedby={describedBy}
        >
          {children}
        </select>
      )}
    </FieldFrame>
  );
}

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'id'> {
  label: string;
}

export function Checkbox({ label, ...rest }: CheckboxProps) {
  const id = useId();
  return (
    <div className="choice">
      <input {...rest} id={id} type="checkbox" />
      <label htmlFor={id}>{label}</label>
    </div>
  );
}
