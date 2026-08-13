import { useId } from 'react';
import type { InputHTMLAttributes, Ref } from 'react';

import './form.css';

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  /** Shown under the input when there is no error — a format, a constraint, a unit. */
  hint?: string;
  error?: string;
  ref?: Ref<HTMLInputElement>;
}

/**
 * A labelled input that says what is wrong with it.
 *
 * The wiring is the point. A red border tells a sighted practitioner something is wrong and tells
 * a screen reader nothing, so the message is bound with `aria-describedby` and the input is
 * marked `aria-invalid`. The label is a real `<label>` with a real `for` — placeholder-as-label
 * disappears the moment someone types, which is exactly when they need it.
 */
export function TextField({ label, hint, error, ref, ...input }: TextFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ');

  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
        {input.required ? (
          <span className="field__required" aria-hidden="true">
            {' '}
            *
          </span>
        ) : null}
      </label>

      <input
        {...input}
        id={id}
        ref={ref}
        className={`field__input${error ? ' field__input--invalid' : ''}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
      />

      {/* Announced when it appears, so the message reaches someone who has already moved on. */}
      {error ? (
        <p className="field__error" id={errorId} role="alert">
          {error}
        </p>
      ) : null}

      {hint && !error ? (
        <p className="field__hint" id={hintId}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
