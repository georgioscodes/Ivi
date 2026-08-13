import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { z } from 'zod';

import { fieldErrorsFrom } from '@/api/messages';
import { TextField } from '@/components/form/TextField';
import { useRegister } from '@/session/session';
import { strings } from '@/strings';
import { authFailureFor } from './authMessages';
import './auth.css';

/**
 * Mirrors the server's bean validation, in Greek.
 *
 * The duplication is deliberate and bounded to shape and length — the rules a form can check
 * without asking. Anything the server knows and the browser does not (is this address already
 * registered) stays server-side and comes back as a field error.
 *
 * The reason for mirroring at all: the server's messages are English. Catching what can be
 * caught here means a practitioner sees Greek for everything they are actually likely to hit.
 */
const schema = z.object({
  email: z
    .string()
    .min(1, 'Το email είναι υποχρεωτικό')
    .email('Μη έγκυρη διεύθυνση email')
    .max(254, 'Το email δεν μπορεί να ξεπερνά τους 254 χαρακτήρες'),
  password: z
    .string()
    .min(12, 'Ο κωδικός πρέπει να έχει τουλάχιστον 12 χαρακτήρες')
    .max(200, 'Ο κωδικός δεν μπορεί να ξεπερνά τους 200 χαρακτήρες'),
  displayName: z
    .string()
    .min(1, 'Το ονοματεπώνυμο είναι υποχρεωτικό')
    .max(120, 'Το ονοματεπώνυμο δεν μπορεί να ξεπερνά τους 120 χαρακτήρες'),
  practiceName: z
    .string()
    .max(160, 'Η επωνυμία δεν μπορεί να ξεπερνά τους 160 χαρακτήρες')
    .optional(),
});

type RegisterForm = z.infer<typeof schema>;

export function RegisterPage() {
  const registration = useRegister();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegisterForm>({ resolver: zodResolver(schema) });

  // Whatever the server rejected that the browser could not know about — a duplicate address,
  // most often — is put on the field it belongs to rather than in a sentence above the form.
  useEffect(() => {
    for (const [field, message] of Object.entries(fieldErrorsFrom(registration.error))) {
      if (field in schema.shape) {
        setError(field as keyof RegisterForm, { type: 'server', message });
      }
    }
  }, [registration.error, setError]);

  const failure = registration.error ? authFailureFor(registration.error) : null;

  // As with sign-in, GuestOnlyRoute decides where a now-signed-in practitioner lands.
  const onSubmit = handleSubmit((values) =>
    registration.mutate({ ...values, practiceName: values.practiceName || undefined }),
  );

  return (
    <main className="auth">
      <div className="auth__card">
        <h1 className="auth__title">{strings.auth.register}</h1>

        <form onSubmit={onSubmit} noValidate>
          {failure ? (
            <p className="form-error" role="alert">
              {failure.message}
            </p>
          ) : null}

          <TextField
            label={strings.auth.displayName}
            autoComplete="name"
            autoFocus
            required
            error={errors.displayName?.message}
            {...register('displayName')}
          />

          <TextField
            label={strings.auth.practiceName}
            autoComplete="organization"
            hint="Προαιρετικό"
            error={errors.practiceName?.message}
            {...register('practiceName')}
          />

          <TextField
            label={strings.auth.email}
            type="email"
            autoComplete="username"
            required
            error={errors.email?.message}
            {...register('email')}
          />

          <TextField
            label={strings.auth.password}
            type="password"
            autoComplete="new-password"
            required
            hint="Τουλάχιστον 12 χαρακτήρες"
            error={errors.password?.message}
            {...register('password')}
          />

          <button
            type="submit"
            className="button button--primary auth__submit"
            disabled={registration.isPending}
          >
            {registration.isPending ? strings.common.loading : strings.auth.register}
          </button>
        </form>

        <p className="auth__alt">
          <Link to="/login">{strings.auth.signIn}</Link>
        </p>
      </div>
    </main>
  );
}
