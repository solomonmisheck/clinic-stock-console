import { useId, type InputHTMLAttributes } from 'react';
import './FormField.css';

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
  /** Hides the visible label but keeps it for assistive tech (e.g. a compact search box). */
  hideLabel?: boolean;
}

export function TextField({
  label,
  hint,
  error,
  hideLabel,
  id,
  className,
  ...rest
}: TextFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;

  return (
    <div className={['field', className].filter(Boolean).join(' ')}>
      <label htmlFor={fieldId} className={hideLabel ? 'visually-hidden' : 'field__label'}>
        {label}
      </label>
      <input
        id={fieldId}
        className="field__control"
        aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
        aria-invalid={Boolean(error) || undefined}
        {...rest}
      />
      {hint && !error && (
        <span id={hintId} className="field__hint">
          {hint}
        </span>
      )}
      {error && (
        <span id={errorId} className="field__error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
