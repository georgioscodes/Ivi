import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { messageFor } from '@/api/messages';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ErrorState, Loading } from '@/components/states';
import { strings } from '@/strings';
import { SuggestionForm } from './SuggestionForm';
import {
  badgeFor,
  categoryLabel,
  formatEnergy,
  formatGrams,
  sourceLabel,
} from './foodLabels';
import { useDeleteFood, useFood, useRevertOverride } from './foodQueries';
import './food.css';

export function FoodDetailPage() {
  const id = Number(useParams().foodId);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const query = useFood(id);
  const revert = useRevertOverride();
  const remove = useDeleteFood();

  // Reachable by link from the override notice, so "this default is wrong for everyone" is one
  // click from the moment the practitioner notices it.
  const [suggesting, setSuggesting] = useState(searchParams.get('suggest') === '1');
  const [confirming, setConfirming] = useState<'revert' | 'delete' | null>(null);

  if (query.isPending) {
    return <Loading />;
  }
  if (query.error) {
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  }

  const food = query.data;
  const badge = badgeFor(food);

  // An override's `source` is PRACTITIONER, which renders as "entered by you" — and they did not
  // enter it, they changed a catalogue entry. Shown next to a "Τροποποιημένο" badge the two
  // statements contradict each other. The badge and the notice below already say what this is.
  const source = food.overridden ? null : sourceLabel(food.source);

  return (
    <>
      <header className="food__header">
        <div>
          <h1 className="page-title">
            {food.nameEl}
            {badge ? (
              <span className={`food-badge food-badge--${badge.kind}`}>{badge.label}</span>
            ) : null}
          </h1>
          <p className="food__subtitle">
            {categoryLabel(food.category)}
            {food.nameEn ? ` · ${food.nameEn}` : ''}
            {source ? ` · ${source}` : ''}
          </p>
        </div>

        <div className="food__header-actions">
          <Link to={`/food/${id}/edit`} className="button button--secondary">
            {strings.common.edit}
          </Link>

          {/* A catalogue food cannot be deleted by anyone; the way to stop seeing its value is to
              override it. Showing a delete button that always 404s would be a lie. */}
          {food.overridden ? (
            <button
              type="button"
              className="button button--secondary"
              onClick={() => setConfirming('revert')}
            >
              Επαναφορά
            </button>
          ) : null}
          {!food.global && !food.overridden ? (
            <button
              type="button"
              className="button button--secondary"
              onClick={() => setConfirming('delete')}
            >
              {strings.common.delete}
            </button>
          ) : null}
        </div>
      </header>

      {food.overridden ? (
        <p className="food__override-notice" role="status">
          <span aria-hidden="true">ℹ </span>
          Βλέπετε τις δικές σας τιμές για αυτό το τρόφιμο. Ο κοινός κατάλογος παραμένει αμετάβλητος
          και η επαναφορά τον επαναφέρει.
        </p>
      ) : null}

      {revert.error ? <p className="form-error" role="alert">{messageFor(revert.error)}</p> : null}
      {remove.error ? <p className="form-error" role="alert">{messageFor(remove.error)}</p> : null}

      <section aria-labelledby="composition-heading">
        <h2 className="section-title" id="composition-heading">
          Σύσταση ανά 100 g
        </h2>
        <dl className="detail-grid">
          <div>
            <dt>Ενέργεια</dt>
            <dd className="food__figure">{formatEnergy(food.energyKcal)} kcal</dd>
          </div>
          <div>
            <dt>Πρωτεΐνη</dt>
            <dd className="food__figure">{formatGrams(food.proteinG)} g</dd>
          </div>
          <div>
            <dt>Υδατάνθρακες</dt>
            <dd className="food__figure">{formatGrams(food.carbohydrateG)} g</dd>
          </div>
          <div>
            <dt>Λίπος</dt>
            <dd className="food__figure">{formatGrams(food.fatG)} g</dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="portions-heading">
        <h2 className="section-title" id="portions-heading">
          Μερίδες
        </h2>
        {food.portions.length === 0 ? (
          <p className="tabs__placeholder">
            Δεν έχουν οριστεί μερίδες. Στα πλάνα θα χρησιμοποιείται το βάρος σε γραμμάρια.
          </p>
        ) : (
          <ul className="food__portions">
            {food.portions.map((portion) => (
              <li key={portion.id}>
                <strong>{portion.label}</strong> · {formatGrams(portion.grams)} g
                {portion.isDefault ? <span className="food__default">Προεπιλογή</span> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Suggestions apply to the shared catalogue, so they only make sense for a catalogue food.
          Proposing a correction to your own entry would mean proposing it to yourself. */}
      {food.global || food.overridden ? (
        <section aria-labelledby="suggest-heading">
          <h2 className="section-title" id="suggest-heading">
            Πρόταση διόρθωσης
          </h2>

          {suggesting ? (
            <SuggestionForm
              food={food}
              onDone={() => {
                setSuggesting(false);
                setSearchParams({}, { replace: true });
              }}
            />
          ) : (
            <>
              <p className="food__suggest-intro">
                Αν η προεπιλεγμένη τιμή είναι λάθος για όλους — όχι μόνο για τη δική σας πρακτική —
                προτείνετε διόρθωση. Η πρόταση δεν αλλάζει τίποτα άμεσα· τίθεται υπό έλεγχο.
              </p>
              <button
                type="button"
                className="button button--secondary"
                onClick={() => setSuggesting(true)}
              >
                Πρόταση διόρθωσης
              </button>
            </>
          )}
        </section>
      ) : null}

      <ConfirmDialog
        open={confirming === 'revert'}
        busy={revert.isPending}
        title="Επαναφορά στις τιμές του καταλόγου"
        body={`Οι δικές σας τιμές για «${food.nameEl}» θα διαγραφούν και θα ισχύουν ξανά οι προεπιλεγμένες. Τα πλάνα που έχουν ήδη δημιουργηθεί δεν αλλάζουν.`}
        confirmLabel="Επαναφορά"
        onCancel={() => setConfirming(null)}
        onConfirm={() =>
          revert.mutate(id, {
            onSuccess: () => navigate('/food', { replace: true }),
            onError: () => setConfirming(null),
          })
        }
      />

      <ConfirmDialog
        open={confirming === 'delete'}
        destructive
        busy={remove.isPending}
        title="Διαγραφή τροφίμου"
        body={`Το τρόφιμο «${food.nameEl}» θα διαγραφεί από τον κατάλογό σας. Τα πλάνα που το περιλαμβάνουν διατηρούν τις τιμές που είχαν καταγραφεί.`}
        confirmLabel={strings.common.delete}
        onCancel={() => setConfirming(null)}
        onConfirm={() =>
          remove.mutate(id, {
            onSuccess: () => navigate('/food', { replace: true }),
            onError: () => setConfirming(null),
          })
        }
      />
    </>
  );
}
