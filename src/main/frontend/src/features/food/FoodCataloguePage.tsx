import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { messageFor } from '@/api/messages';
import { usePageTitle } from '@/app/usePageTitle';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Empty, ErrorState, Skeleton } from '@/components/states';
import { Pagination } from '@/components/Pagination';
import { useDebounced } from '@/components/useDebounced';
import { strings } from '@/strings';
import {
  FOOD_CATEGORIES,
  badgeFor,
  categoryLabel,
  formatEnergy,
  formatGrams,
} from './foodLabels';
import { useFoods, useRevertOverride } from './foodQueries';
import './food.css';

const PAGE_SIZE = 20;

export function FoodCataloguePage() {
  usePageTitle('Τρόφιμα');
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get('page') ?? 0);
  const category = searchParams.get('category') ?? '';

  const [typed, setTyped] = useState(searchParams.get('q') ?? '');
  const q = useDebounced(typed);

  const query = useFoods({ q: q || undefined, category: category || undefined, page, size: PAGE_SIZE });
  const revert = useRevertOverride();
  const [reverting, setReverting] = useState<{ id: number; name: string } | null>(null);

  function updateParams(next: { q?: string; category?: string; page?: number }) {
    const params: Record<string, string> = {};
    const term = next.q ?? q;
    const cat = next.category ?? category;
    if (term) params.q = term;
    if (cat) params.category = cat;
    if (next.page) params.page = String(next.page);
    setSearchParams(params, { replace: next.page === undefined });
  }

  return (
    <>
      <header className="food__header">
        <div>
          <h1 className="page-title">Τρόφιμα</h1>
          <p className="food__subtitle">
            Ο κατάλογός σας: τα δικά σας τρόφιμα και όσα του κοινού καταλόγου δεν έχετε τροποποιήσει
          </p>
        </div>
        <div className="food__header-actions">
          <Link to="/food/suggestions" className="button button--secondary">
            Οι προτάσεις μου
          </Link>
          <Link to="/food/new" className="button button--primary">
            Νέο τρόφιμο
          </Link>
        </div>
      </header>

      <div className="food__filters">
        <div className="food__search">
          <label className="visually-hidden" htmlFor="food-search">
            {strings.common.search}
          </label>
          <input
            id="food-search"
            type="search"
            className="field__input"
            placeholder="Αναζήτηση τροφίμου…"
            value={typed}
            onChange={(event) => {
              setTyped(event.target.value);
              updateParams({ q: event.target.value });
            }}
          />
        </div>

        <div className="food__category">
          <label className="visually-hidden" htmlFor="food-category">
            Κατηγορία
          </label>
          <select
            id="food-category"
            className="field__input"
            value={category}
            onChange={(event) => updateParams({ category: event.target.value })}
          >
            <option value="">Όλες οι κατηγορίες</option>
            {FOOD_CATEGORIES.map((option) => (
              <option key={option.code} value={option.code}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {query.isPending ? <Skeleton rows={6} /> : null}
      {query.error ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : null}
      {revert.error ? (
        <p className="form-error" role="alert">
          {messageFor(revert.error)}
        </p>
      ) : null}

      {query.data && query.data.content.length === 0 ? (
        <Empty
          title={strings.empty.noResults}
          hint={q || category ? strings.empty.noResultsHint : 'Προσθέστε το πρώτο σας τρόφιμο.'}
        />
      ) : null}

      {query.data && query.data.content.length > 0 ? (
        <>
          <div className="table-scroll">
            <table className="table">
              <caption className="visually-hidden">Κατάλογος τροφίμων, ανά 100 γραμμάρια</caption>
              <thead>
                <tr>
                  <th scope="col">Τρόφιμο</th>
                  <th scope="col">Κατηγορία</th>
                  {/* Stated once in the header rather than repeated in every cell. */}
                  <th scope="col" className="numeric">kcal / 100g</th>
                  <th scope="col" className="numeric">Πρωτ. (g)</th>
                  <th scope="col" className="numeric">Υδατ. (g)</th>
                  <th scope="col" className="numeric">Λίπος (g)</th>
                  <th scope="col"><span className="visually-hidden">Ενέργειες</span></th>
                </tr>
              </thead>
              <tbody>
                {query.data.content.map((food) => {
                  const badge = badgeFor(food);
                  return (
                    <tr key={food.id}>
                      <th scope="row">
                        <Link to={`/food/${food.id}`}>{food.nameEl}</Link>
                        {/*
                          An overridden food carries the practitioner's own values under a
                          catalogue name. That is exactly the case where an unmarked row would
                          mislead — they are about to put these numbers in a plan.
                        */}
                        {badge ? (
                          <span className={`food-badge food-badge--${badge.kind}`}>
                            {badge.label}
                          </span>
                        ) : null}
                        {food.nameEn ? <span className="food__name-en">{food.nameEn}</span> : null}
                      </th>
                      <td>{categoryLabel(food.category)}</td>
                      <td className="numeric">{formatEnergy(food.energyKcal)}</td>
                      <td className="numeric">{formatGrams(food.proteinG)}</td>
                      <td className="numeric">{formatGrams(food.carbohydrateG)}</td>
                      <td className="numeric">{formatGrams(food.fatG)}</td>
                      <td className="food__row-actions">
                        <Link to={`/food/${food.id}/edit`} className="button button--link">
                          {strings.common.edit}
                        </Link>
                        {food.overridden ? (
                          <button
                            type="button"
                            className="button button--link"
                            onClick={() => setReverting({ id: food.id, name: food.nameEl })}
                          >
                            Επαναφορά
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Pagination
            page={query.data.page}
            totalPages={query.data.totalPages}
            totalElements={query.data.totalElements}
            onChange={(next) => updateParams({ page: next })}
            busy={query.isFetching}
            noun="τρόφιμα"
          />
        </>
      ) : null}

      <ConfirmDialog
        open={reverting !== null}
        busy={revert.isPending}
        title="Επαναφορά στις τιμές του καταλόγου"
        body={`Οι δικές σας τιμές για «${reverting?.name ?? ''}» θα διαγραφούν και θα ισχύουν ξανά οι προεπιλεγμένες. Τα πλάνα που έχουν ήδη δημιουργηθεί δεν αλλάζουν.`}
        confirmLabel="Επαναφορά"
        onCancel={() => setReverting(null)}
        onConfirm={() =>
          reverting &&
          revert.mutate(reverting.id, { onSettled: () => setReverting(null) })
        }
      />
    </>
  );
}
