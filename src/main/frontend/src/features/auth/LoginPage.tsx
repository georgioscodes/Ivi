import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { z } from 'zod';

import { TextField } from '@/components/form/TextField';
import { useLogin } from '@/session/session';
import { strings } from '@/strings';
import { authFailureFor } from './authMessages';
import './auth.css';

/**
 * Client-side rules are shape only — is there an address, is there a password. Whether the
 * password is *correct* is the server's business, and no rule here should imply otherwise.
 */
const schema = z.object({
  email: z.string().min(1, 'Συμπληρώστε το email σας').email('Μη έγκυρη διεύθυνση email'),
  password: z.string().min(1, 'Συμπληρώστε τον κωδικό σας'),
});

type LoginForm = z.infer<typeof schema>;

export function LoginPage() {
  const login = useLogin();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(schema) });

  const failure = login.error ? authFailureFor(login.error) : null;

  // No navigation on success. GuestOnlyRoute owns where a signed-in practitioner goes, including
  // resuming the link that sent them here — see the note there about the two racing redirects.
  const onSubmit = handleSubmit((values) => login.mutate(values));

  return (
    <main className="auth">
      <div className="auth__card">
        <h1 className="auth__title">{strings.app.name}</h1>
        <p className="auth__tagline">{strings.app.tagline}</p>

        <form onSubmit={onSubmit} noValidate>
          {failure ? (
            <p
              className={`form-error${failure.waiting ? ' form-error--waiting' : ''}`}
              role="alert"
            >
              {failure.message}
            </p>
          ) : null}

          <TextField
            label={strings.auth.email}
            type="email"
            autoComplete="username"
            // The practitioner arrives here to type; put them in the field.
            autoFocus
            required
            error={errors.email?.message}
            {...register('email')}
          />

          <TextField
            label={strings.auth.password}
            type="password"
            autoComplete="current-password"
            required
            error={errors.password?.message}
            {...register('password')}
          />

          <button
            type="submit"
            className="button button--primary auth__submit"
            // Disabled while locked out: the form should stop inviting the action that caused it.
            disabled={login.isPending || failure?.waiting === true}
          >
            {login.isPending ? strings.common.loading : strings.auth.signIn}
          </button>
        </form>

        <p className="auth__alt">
          <Link to="/register">{strings.auth.register}</Link>
        </p>
      </div>
    </main>
  );
}
