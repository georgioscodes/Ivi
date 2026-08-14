import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import type { PlanDayResponse, PlanItemResponse, PlanMealResponse } from '@/api/types';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ErrorState, Loading } from '@/components/states';
import { useClient } from '@/features/client/clientQueries';
import { strings } from '@/strings';
import { AddFoodDialog } from './AddFoodDialog';
import { PlanView } from './PlanView';
import { RenameItemDialog } from './RenameItemDialog';
import { SaveStatus } from './SaveStatus';
import { usePlanSaveState } from './usePlanSaveState';
import { dayLabel, formatGrams, formatKcal, mealLabel, statusLabel } from './planLabels';
import { useAddItem, useRemoveItem, useUpdateItem } from './planMutations';
import { usePlan } from './planQueries';
import './plan.css';

/**
 * The plan builder's own route: `/client/:clientId/plan/:planId`.
 *
 * A full page rather than a tab panel, because building a plan is the longest thing a
 * practitioner does in this application and it needs the width.
 */
export function PlanPage() {
  const params = useParams();
  const clientId = Number(params.clientId);
  const planId = Number(params.planId);

  const plan = usePlan(planId);
  const client = useClient(clientId);
  const addItem = useAddItem(planId);
  const updateItem = useUpdateItem(planId);
  const removeItem = useRemoveItem(planId);

  const [renaming, setRenaming] = useState<PlanItemResponse | null>(null);
  const [removing, setRemoving] = useState<PlanItemResponse | null>(null);
  // Which item is mid-request, so its row can say so and its controls stop accepting input.
  const [pendingItemId, setPendingItemId] = useState<number | null>(null);

  // The last edit that failed, kept so a transient failure can be retried without the
  // practitioner having to reconstruct what they were doing.
  const [lastEdit, setLastEdit] = useState<(() => void) | null>(null);

  const save = usePlanSaveState([addItem, updateItem, removeItem]);

  // Which meal the food picker is filling. Held here rather than inside the dialog so the plan
  // view can mark that meal pending while the request is in flight.
  const [target, setTarget] = useState<{ day: PlanDayResponse; meal: PlanMealResponse } | null>(
    null,
  );

  if (plan.isPending) {
    return <Loading />;
  }
  if (plan.error) {
    return <ErrorState error={plan.error} onRetry={() => void plan.refetch()} />;
  }

  const data = plan.data;

  return (
    <>
      <nav className="plan__breadcrumb" aria-label="Διαδρομή">
        <Link to={`/client/${clientId}/plans`}>
          {client.data ? client.data.fullName : 'Πελάτης'}
        </Link>
        <span aria-hidden="true"> · </span>
        <span>Πλάνα</span>
      </nav>

      <header className="plan__header">
        <div>
          <h1 className="page-title">{data.name}</h1>
          <p className="plan__meta">
            <span className={`status status--${data.status.toLowerCase()}`}>
              {statusLabel(data.status)}
            </span>
            <span aria-hidden="true"> · </span>
            {data.days.length} {data.days.length === 1 ? 'ημέρα' : 'ημέρες'}
          </p>
        </div>
      </header>

      <section className="plan__targets" aria-labelledby="targets-heading">
        <h2 className="section-title" id="targets-heading">
          Ημερήσιοι στόχοι
        </h2>
        <dl className="plan__target-grid">
          <div>
            <dt>Ενέργεια</dt>
            <dd>{formatKcal(data.targets.energyKcal)} kcal</dd>
          </div>
          <div>
            <dt>Πρωτεΐνη</dt>
            <dd>{formatGrams(data.targets.proteinG)} g</dd>
          </div>
          <div>
            <dt>Υδατάνθρακες</dt>
            <dd>{formatGrams(data.targets.carbohydrateG)} g</dd>
          </div>
          <div>
            <dt>Λίπος</dt>
            <dd>{formatGrams(data.targets.fatG)} g</dd>
          </div>
        </dl>

        {/* The average across every day, from the server. For a plan whose days differ this is
            the figure that says whether the week works, which no single day does. */}
        <dl className="plan__target-grid plan__target-grid--average">
          <div>
            <dt>Μέσος όρος ημέρας</dt>
            <dd>{formatKcal(data.dailyAverage.energyKcal)} kcal</dd>
          </div>
          <div>
            <dt>Πρωτεΐνη</dt>
            <dd>{formatGrams(data.dailyAverage.proteinG)} g</dd>
          </div>
          <div>
            <dt>Υδατάνθρακες</dt>
            <dd>{formatGrams(data.dailyAverage.carbohydrateG)} g</dd>
          </div>
          <div>
            <dt>Λίπος</dt>
            <dd>{formatGrams(data.dailyAverage.fatG)} g</dd>
          </div>
        </dl>
      </section>

      {/*
        One indicator for the whole plan. There is no save button — every edit commits on its own
        — so this is the only thing telling a practitioner their work is safe.
      */}
      <SaveStatus
        state={save.state}
        error={save.error}
        onReload={() => {
          updateItem.reset();
          removeItem.reset();
          addItem.reset();
          void plan.refetch();
        }}
        onRetry={
          lastEdit
            ? () => {
                updateItem.reset();
                removeItem.reset();
                lastEdit();
              }
            : undefined
        }
      />

      <PlanView
        plan={data}
        onAddFood={(day, meal) => setTarget({ day, meal })}
        pendingMealId={addItem.isPending ? (target?.meal.id ?? null) : null}
        itemActions={{
          pendingItemId,
          onRename: setRenaming,
          onRemove: setRemoving,
          onQuantityChange: (itemId, quantity) => {
            const apply = () => {
              setPendingItemId(itemId);
              updateItem.mutate(
                { itemId, body: { quantity } },
                { onSettled: () => setPendingItemId(null) },
              );
            };
            // Kept so a network failure can be retried with the same edit, rather than asking
            // the practitioner to remember what they had typed.
            setLastEdit(() => apply);
            apply();
          },
        }}
      />

      <RenameItemDialog
        item={renaming}
        busy={updateItem.isPending}
        error={renaming ? updateItem.error : null}
        onClose={() => {
          setRenaming(null);
          updateItem.reset();
        }}
        onSave={(nameOverride) => {
          if (!renaming) {
            return;
          }
          setPendingItemId(renaming.id);
          updateItem.mutate(
            { itemId: renaming.id, body: { nameOverride } },
            {
              onSuccess: () => setRenaming(null),
              onSettled: () => setPendingItemId(null),
            },
          );
        }}
      />

      {/*
        A confirmation rather than an undo, deliberately. An "undo" here could only re-add the
        food, which takes a *fresh* composition snapshot from the catalogue — so if the
        practitioner had overridden that food in between, the restored line would not be the one
        they removed. An undo that silently substitutes different numbers is worse than a prompt.
      */}
      <ConfirmDialog
        open={removing !== null}
        destructive
        busy={removeItem.isPending}
        title="Αφαίρεση τροφίμου"
        body={`Το «${removing?.name ?? ''}» θα αφαιρεθεί από το πλάνο. Η ενέργεια δεν αναιρείται.`}
        confirmLabel={strings.common.delete}
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          if (!removing) {
            return;
          }
          setPendingItemId(removing.id);
          removeItem.mutate(removing.id, {
            onSettled: () => {
              setPendingItemId(null);
              setRemoving(null);
            },
          });
        }}
      />

      <AddFoodDialog
        open={target !== null}
        dayLabel={target ? dayLabel(target.day) : ''}
        mealLabel={target ? mealLabel(target.meal.mealType) : ''}
        busy={addItem.isPending}
        error={addItem.error}
        onClose={() => {
          setTarget(null);
          addItem.reset();
        }}
        onAdd={(body) => {
          if (!target) {
            return;
          }
          addItem.mutate(
            { mealId: target.meal.id, body },
            // Closed on success only. A failed add keeps the dialog open with the message, so
            // the practitioner does not have to find the food again to retry.
            { onSuccess: () => setTarget(null) },
          );
        }}
      />
    </>
  );
}
