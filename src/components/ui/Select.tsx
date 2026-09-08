import { useId, type ReactNode, type SelectHTMLAttributes } from 'react';
import './FormField.css';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  hideLabel?: boolean;
  children: ReactNode;
}

export function Select({ label, hideLabel, id, className, children, ...rest }: SelectProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;

  return (
    <div className={['field', className].filter(Boolean).join(' ')}>
      <label htmlFor={fieldId} className={hideLabel ? 'visually-hidden' : 'field__label'}>
        {label}
      </label>
      <select id={fieldId} className="field__control" {...rest}>
        {children}
      </select>
    </div>
  );
}
