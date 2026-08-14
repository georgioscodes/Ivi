import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { messageFor } from '@/api/messages';
import type { PlanDayResponse, PlanItemResponse, PlanMealResponse } from '@/api/types';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ErrorState, Loading } from '@/components/states';
import { useClient } from '@/features/client/clientQueries';
import { strings } from '@/strings';
import { AddFoodDialog } from './AddFoodDialog';
import { PlanAnalysis } from './PlanAnalysis';
import { PlanNotes } from './PlanNotes';
import { PlanView } from './PlanView';
import { RenameItemDialog } from './RenameItemDialog';
import { SaveStatus } from './SaveStatus';
import { usePlanSaveState } from './usePlanSaveState';
import {
  dayLabel,
  formatGrams,
  formatKcal,
  mealLabel,
  nextStatusAction,
  statusLabel,
} from './planLabels';
import {
  useAddItem,
  useClearDay,
  useRemoveItem,
  useReorderItems,
  useUpdateItem,
  useUpdateStatus,
} from './planMutations';
import { useExportPlan } from './planExport';
import { useDeletePlan, usePlan } from './planQueries';
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
  const navigate = useNavigate();

  const plan = usePlan(planId);
  const client = useClient(clientId);
  const addItem = useAddItem(planId);
  const updateItem = useUpdateItem(planId);
  const removeItem = useRemoveItem(planId);
  const reorderItems = useReorderItems(planId);
  const clearDay = useClearDay(planId);
  const updateStatus = useUpdateStatus(planId);
  const deletePlan = useDeletePlan();
  const exportPlan = useExportPlan(planId);

  const [clearing, setClearing] = useState<PlanDayResponse | null>(null);
  const [deletingPlan, setDeletingPlan] = useState(false);

  const [renaming, setRenaming] = useState<PlanItemResponse | null>(null);
  const [removing, setRemoving] = useState<PlanItemResponse | null>(null);
  // Which item is mid-request, so its row can say so and its controls stop accepting input.
  const [pendingItemId, setPendingItemId] = useState<number | null>(null);

  // The last edit that failed, kept so a transient failure can be retried without the
  // practitioner having to reconstruct what they were doing.
  const [lastEdit, setLastEdit] = useState<(() => void) | null>(null);

  const save = usePlanSaveState([
    addItem,
    updateItem,
    removeItem,
    reorderItems,
    clearDay,
    updateStatus,
  ]);

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
  const statusAction = nextStatusAction(data.status);

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

        <div className="plan__header-actions">
          {/*
            The fallback name is only used if Content-Disposition arrives without one — the server
            names the file after the client and the plan, and that name is the one to keep.
          */}
          <button
            type="button"
            className="button button--secondary"
            disabled={exportPlan.isPending}
            onClick={() =>
              exportPlan.mutate(
                client.data ? `${client.data.fullName} - ${data.name}` : data.name,
              )
            }
          >
            {exportPlan.isPending ? 'Δημιουργία PDF…' : 'Λήψη PDF'}
          </button>
          {statusAction ? (
            <button
              type="button"
              className="button button--primary"
              title={statusAction.explanation}
              disabled={updateStatus.isPending}
              onClick={() => updateStatus.mutate(statusAction.status)}
            >
              {updateStatus.isPending ? strings.common.saving : statusAction.label}
            </button>
          ) : null}
          <button
            type="button"
            className="button button--secondary"
            onClick={() => setDeletingPlan(true)}
          >
            {strings.common.delete}
          </button>
        </div>
      </header>

      {/* The PDF is fetched rather than linked, so a failure lands here as a message instead of
          as a browser error page on a blank tab. */}
      {exportPlan.error ? (
        <p className="form-error" role="alert">
          Το PDF δεν δημιουργήθηκε. {messageFor(exportPlan.error)}
        </p>
      ) : null}

      {/*
        Archived plans stay editable — the server permits it and there are legitimate reasons —
        but they are part of the clinical record, so changing one silently is not the same act as
        editing a draft.
      */}
      {data.status === 'ARCHIVED' ? (
        <p className="plan__archived-notice" role="status">
          <span aria-hidden="true">ℹ </span>
          Αυτό το πλάνο είναι αρχειοθετημένο και αποτελεί μέρος του ιστορικού του πελάτη. Οι
          αλλαγές που κάνετε καταγράφονται κανονικά.
        </p>
      ) : null}

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

      </section>

      {/*
        The daily average used to sit up here next to the targets. It has moved into the summary
        table, as its last row: an average is only readable against the days it averages, and two
        copies of the same four numbers on one screen invite the question of why they differ —
        which, the moment one of them is stale, they will.
      */}
      <PlanAnalysis plan={data} />

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
          reorderItems.reset();
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
        onReorder={(mealId, orderedItemIds) => reorderItems.mutate({ mealId, orderedItemIds })}
        onClearDay={setClearing}
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

      <PlanNotes planId={planId} notes={data.notes} />

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
        open={clearing !== null}
        destructive
        busy={clearDay.isPending}
        title="Καθαρισμός ημέρας"
        /*
          Phrased so the label sits in apposition after «ημέρας» rather than being inflected.
          Interpolating it straight after a preposition gave "της Δευτέρα" — the label is
          nominative and the sentence wanted a genitive. Weekday names could be given genitive
          forms, but a practitioner's own label ("Ημέρα προπόνησης") could not, so the sentence
          has to hold any label without declining it.
        */
        body={`Τα τρόφιμα της ημέρας «${clearing ? dayLabel(clearing) : ''}» θα αφαιρεθούν. Τα γεύματα παραμένουν, έτοιμα να συμπληρωθούν ξανά. Η ενέργεια δεν αναιρείται.`}
        confirmLabel="Καθαρισμός"
        onCancel={() => setClearing(null)}
        onConfirm={() => {
          if (clearing) {
            clearDay.mutate(clearing.dayIndex, { onSettled: () => setClearing(null) });
          }
        }}
      />

      <ConfirmDialog
        open={deletingPlan}
        destructive
        busy={deletePlan.isPending}
        title="Διαγραφή πλάνου"
        body={`Το πλάνο «${data.name}» θα διαγραφεί οριστικά, μαζί με όλες τις ημέρες και τα τρόφιμά του. Η ενέργεια δεν αναιρείται.`}
        confirmLabel={strings.common.delete}
        onCancel={() => setDeletingPlan(false)}
        onConfirm={() =>
          deletePlan.mutate(planId, {
            onSuccess: () => navigate(`/client/${clientId}/plans`, { replace: true }),
            onError: () => setDeletingPlan(false),
          })
        }
      />

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
