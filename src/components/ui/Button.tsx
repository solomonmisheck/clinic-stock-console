import { forwardRef, type ButtonHTMLAttributes } from 'react';
import './Button.css';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', isLoading = false, disabled, children, className, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={['btn', `btn--${variant}`, className].filter(Boolean).join(' ')}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...rest}
    >
      {isLoading && <span className="btn__spinner" aria-hidden="true" />}
      <span>{children}</span>
    </button>
  );
});
