import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { fieldErrorsFrom, messageFor } from '@/api/messages';
import { ErrorState, Loading } from '@/components/states';
import { TextField } from '@/components/form/TextField';
import { strings } from '@/strings';
import { clientSchema, toRequest, type ClientForm } from './clientSchema';
import { useClient, useCreateClient, useUpdateClient } from './clientQueries';
import './client.css';

/** One component for both, because the fields and rules are identical and would drift apart. */
export function ClientFormPage({ mode }: { mode: 'create' | 'edit' }) {
  const params = useParams();
  const id = Number(params.clientId);

  return mode === 'edit' ? <EditClient id={id} /> : <ClientFields />;
}

function EditClient({ id }: { id: number }) {
  const query = useClient(id);

  if (query.isPending) {
    return <Loading />;
  }
  if (query.error) {
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  }

  return (
    <ClientFields
      id={id}
      initial={{
        fullName: query.data.fullName,
        email: query.data.email ?? '',
        phone: query.data.phone ?? '',
        dateOfBirth: query.data.dateOfBirth ?? '',
        goal: query.data.goal ?? '',
        notes: query.data.notes ?? '',
      }}
    />
  );
}

function ClientFields({ id, initial }: { id?: number; initial?: ClientForm }) {
  const navigate = useNavigate();
  const create = useCreateClient();
  const update = useUpdateClient(id ?? 0);
  const mutation = id ? update : create;

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isDirty },
  } = useForm<ClientForm>({
    resolver: zodResolver(clientSchema),
    defaultValues: initial ?? { fullName: '' },
  });

  // Anything the server rejected that the browser could not know about goes onto its field.
  useEffect(() => {
    for (const [field, message] of Object.entries(fieldErrorsFrom(mutation.error))) {
      if (field in clientSchema.shape) {
        setError(field as keyof ClientForm, { type: 'server', message });
      }
    }
  }, [mutation.error, setError]);

  const onSubmit = handleSubmit((values) => {
    mutation.mutate(toRequest(values), {
      onSuccess: (saved) => navigate(`/client/${saved.id}`, { replace: true }),
    });
  });

  // Field errors are already on their fields; repeating them above the form says nothing new.
  const summary =
    mutation.error && Object.keys(fieldErrorsFrom(mutation.error)).length === 0
      ? messageFor(mutation.error)
      : null;

  return (
    <>
      <h1 className="page-title">{id ? 'Επεξεργασία πελάτη' : 'Νέος πελάτης'}</h1>

      <form className="client-form" onSubmit={onSubmit} noValidate>
        {summary ? (
          <p className="form-error" role="alert">
            {summary}
          </p>
        ) : null}

        <TextField
          label="Ονοματεπώνυμο"
          autoComplete="off"
          autoFocus
          required
          error={errors.fullName?.message}
          {...register('fullName')}
        />

        <div className="client-form__row">
          <TextField
            label="Email"
            type="email"
            autoComplete="off"
            error={errors.email?.message}
            {...register('email')}
          />
          <TextField
            label="Τηλέφωνο"
            type="tel"
            autoComplete="off"
            error={errors.phone?.message}
            {...register('phone')}
          />
        </div>

        <TextField
          label="Ημερομηνία γέννησης"
          type="date"
          error={errors.dateOfBirth?.message}
          {...register('dateOfBirth')}
        />

        <TextField
          label="Στόχος"
          hint="Έως 500 χαρακτήρες"
          error={errors.goal?.message}
          {...register('goal')}
        />

        <div className="field">
          <label className="field__label" htmlFor="client-notes">
            Σημειώσεις
          </label>
          <textarea id="client-notes" className="field__input" rows={5} {...register('notes')} />
        </div>

        <div className="client-form__actions">
          <Link to={id ? `/client/${id}` : '/'} className="button button--secondary">
            {strings.common.cancel}
          </Link>
          <button
            type="submit"
            className="button button--primary"
            disabled={mutation.isPending || (id !== undefined && !isDirty)}
          >
            {mutation.isPending ? strings.common.saving : strings.common.save}
          </button>
        </div>
      </form>
    </>
  );
}
