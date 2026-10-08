import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

const classes = (variant: ButtonVariant, block?: boolean): string =>
  `btn btn--${variant}${block ? ' btn--block' : ''}`;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** Shows a spinner and blocks repeat clicks while a request is running. */
  loading?: boolean;
  block?: boolean;
  icon?: ReactNode;
}

export function Button({
  variant = 'primary',
  loading = false,
  block,
  icon,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      className={classes(variant, block)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading ? <span className="spinner" aria-hidden="true" /> : icon}
      {children}
    </button>
  );
}

interface ButtonLinkProps extends LinkProps {
  variant?: ButtonVariant;
  block?: boolean;
}

/** A navigation link that looks like a button (never use `<Button>` inside `<Link>`). */
export function ButtonLink({ variant = 'primary', block, ...rest }: ButtonLinkProps) {
  return <Link {...rest} className={classes(variant, block)} />;
}
