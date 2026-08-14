import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { fieldErrorsFrom, messageFor } from '@/api/messages';
import { ErrorState, Loading } from '@/components/states';
import { TextField } from '@/components/form/TextField';
import { strings } from '@/strings';
import { FOOD_CATEGORIES } from './foodLabels';
import { PortionEditor } from './PortionEditor';
import { foodSchema, toRequest, type FoodForm } from './foodSchema';
import { useCreateFood, useFood, useUpdateFood } from './foodQueries';
import './food.css';

export function FoodFormPage({ mode }: { mode: 'create' | 'edit' }) {
  const id = Number(useParams().foodId);
  return mode === 'edit' ? <EditFood id={id} /> : <FoodFields />;
}

function EditFood({ id }: { id: number }) {
  const query = useFood(id);

  if (query.isPending) {
    return <Loading />;
  }
  if (query.error) {
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  }

  const food = query.data;

  return (
    <FoodFields
      id={id}
      // A catalogue food this practitioner has not yet overridden. Saving will not change the
      // shared entry — it will create their own copy — and they should know that before typing.
      willCreateOverride={food.global && !food.overridden}
      initial={{
        nameEl: food.nameEl,
        nameEn: food.nameEn ?? '',
        category: food.category as FoodForm['category'],
        energyKcal: food.energyKcal,
        proteinG: food.proteinG,
        carbohydrateG: food.carbohydrateG,
        fatG: food.fatG,
        portions: food.portions.map((portion) => ({
          label: portion.label,
          grams: portion.grams,
          isDefault: portion.isDefault,
        })),
      }}
    />
  );
}

interface FoodFieldsProps {
  id?: number;
  initial?: FoodForm;
  willCreateOverride?: boolean;
}

function FoodFields({ id, initial, willCreateOverride = false }: FoodFieldsProps) {
  const navigate = useNavigate();
  const create = useCreateFood();
  const update = useUpdateFood();
  const mutation = id ? update : create;

  const [portions, setPortions] = useState<FoodForm['portions']>(initial?.portions ?? []);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FoodForm>({
    resolver: zodResolver(foodSchema),
    defaultValues: initial ?? {
      nameEl: '',
      nameEn: '',
      category: 'FRESH',
      portions: [],
    },
  });

  useEffect(() => {
    for (const [field, message] of Object.entries(fieldErrorsFrom(mutation.error))) {
      if (field in foodSchema.shape) {
        setError(field as keyof FoodForm, { type: 'server', message });
      }
    }
  }, [mutation.error, setError]);

  const onSubmit = handleSubmit((values) => {
    const body = toRequest({ ...values, portions });
    const done = (saved: { id: number }) => navigate(`/food/${saved.id}`, { replace: true });

    if (id) {
      update.mutate({ id, body }, { onSuccess: done });
    } else {
      create.mutate(body, { onSuccess: done });
    }
  });

  const summary =
    mutation.error && Object.keys(fieldErrorsFrom(mutation.error)).length === 0
      ? messageFor(mutation.error)
      : null;

  // The schema's cross-field rule lands on `portions` and is not tied to any single input.
  const portionError =
    errors.portions?.message ??
    (portions.some((portion) => !portion.label.trim() || !(portion.grams > 0))
      ? 'Κάθε μερίδα χρειάζεται ονομασία και βάρος μεγαλύτερο από μηδέν'
      : undefined);

  return (
    <>
      <h1 className="page-title">{id ? 'Επεξεργασία τροφίμου' : 'Νέο τρόφιμο'}</h1>

      {willCreateOverride ? (
        <p className="food__override-notice" role="status">
          <span aria-hidden="true">ℹ </span>
          Αυτό είναι τρόφιμο του κοινού καταλόγου. Η αποθήκευση δημιουργεί τη <strong>δική σας
          εκδοχή</strong> — ο κοινός κατάλογος δεν αλλάζει και μπορείτε να επανέλθετε ανά πάσα
          στιγμή. Αν θεωρείτε ότι η προεπιλεγμένη τιμή είναι λάθος για όλους,{' '}
          <Link to={`/food/${id}?suggest=1`}>προτείνετε διόρθωση</Link>.
        </p>
      ) : null}

      <form className="food-form" onSubmit={onSubmit} noValidate>
        {summary ? (
          <p className="form-error" role="alert">
            {summary}
          </p>
        ) : null}

        <TextField
          label="Ονομασία (ελληνικά)"
          required
          autoFocus
          error={errors.nameEl?.message}
          {...register('nameEl')}
        />

        <div className="food-form__row">
          <TextField
            label="Ονομασία (αγγλικά)"
            hint="Προαιρετικό"
            error={errors.nameEn?.message}
            {...register('nameEn')}
          />

          <div className="field">
            <label className="field__label" htmlFor="food-category-input">
              Κατηγορία<span className="field__required" aria-hidden="true"> *</span>
            </label>
            <select id="food-category-input" className="field__input" {...register('category')}>
              {FOOD_CATEGORIES.map((category) => (
                <option key={category.code} value={category.code}>
                  {category.label}
                </option>
              ))}
            </select>
            {errors.category ? (
              <p className="field__error" role="alert">
                {errors.category.message}
              </p>
            ) : null}
          </div>
        </div>

        <h2 className="food-form__heading">Σύσταση ανά 100 g</h2>

        <div className="food-form__row">
          <TextField
            label="Ενέργεια (kcal)"
            type="number"
            step="1"
            min="0"
            required
            error={errors.energyKcal?.message}
            {...register('energyKcal', { valueAsNumber: true })}
          />
          <TextField
            label="Πρωτεΐνη (g)"
            type="number"
            step="0.1"
            min="0"
            required
            error={errors.proteinG?.message}
            {...register('proteinG', { valueAsNumber: true })}
          />
          <TextField
            label="Υδατάνθρακες (g)"
            type="number"
            step="0.1"
            min="0"
            required
            error={errors.carbohydrateG?.message}
            {...register('carbohydrateG', { valueAsNumber: true })}
          />
          <TextField
            label="Λίπος (g)"
            type="number"
            step="0.1"
            min="0"
            required
            error={errors.fatG?.message}
            {...register('fatG', { valueAsNumber: true })}
          />
        </div>

        <PortionEditor portions={portions} onChange={setPortions} error={portionError} />

        <div className="food-form__actions">
          <Link to={id ? `/food/${id}` : '/food'} className="button button--secondary">
            {strings.common.cancel}
          </Link>
          <button
            type="submit"
            className="button button--primary"
            disabled={mutation.isPending || portionError !== undefined}
          >
            {mutation.isPending
              ? strings.common.saving
              : willCreateOverride
                ? 'Αποθήκευση δικής μου εκδοχής'
                : strings.common.save}
          </button>
        </div>
      </form>
    </>
  );
}
