import { useState } from 'react';
import { useParams } from 'react-router-dom';

import { messageFor } from '@/api/messages';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Empty, ErrorState, Loading, Skeleton } from '@/components/states';
import { Pagination } from '@/components/Pagination';
import { formatDate } from '@/features/client/clientQueries';
import { strings } from '@/strings';
import { MeasurementChart } from './MeasurementChart';
import { SingleMeasurementForm } from './SingleMeasurementForm';
import { VisitEntryForm } from './VisitEntryForm';
import {
  bmiCategoryLabel,
  decimalsFor,
  formatChange,
  formatValue,
  formatWithUnit,
  indexTypes,
  orderForDisplay,
} from './measurementFormat';
import {
  useDeleteMeasurement,
  useMeasurementHistory,
  useMeasurementSeries,
  useMeasurementSummary,
  useMeasurementTypes,
} from './measurementQueries';
import './measurement.css';

type Entry = 'none' | 'visit' | 'single';

export function MeasurementsTab() {
  const clientId = Number(useParams().clientId);

  const [entry, setEntry] = useState<Entry>('none');
  const [page, setPage] = useState(0);
  const [seriesType, setSeriesType] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  const types = useMeasurementTypes();
  const summary = useMeasurementSummary(clientId);
  const history = useMeasurementHistory(clientId, page);
  const series = useMeasurementSeries(clientId, seriesType);
  const remove = useDeleteMeasurement(clientId);

  const typeIndex = indexTypes(types.data);

  if (types.isPending) {
    return <Loading />;
  }
  if (types.error) {
    return <ErrorState error={types.error} onRetry={() => void types.refetch()} />;
  }

  if (entry !== 'none') {
    return entry === 'visit' ? (
      <VisitEntryForm clientId={clientId} types={types.data} onDone={() => setEntry('none')} />
    ) : (
      <SingleMeasurementForm
        clientId={clientId}
        types={types.data}
        onDone={() => setEntry('none')}
      />
    );
  }

  // Only types this client actually has readings for. Offering all fourteen would mean thirteen
  // empty charts.
  const measuredTypes = [...new Set((summary.data?.latest ?? []).map((m) => m.typeCode))];

  return (
    <>
      <div className="measurement__actions">
        <button
          type="button"
          className="button button--primary"
          onClick={() => setEntry('visit')}
        >
          Καταγραφή επίσκεψης
        </button>
        <button
          type="button"
          className="button button--secondary"
          onClick={() => setEntry('single')}
        >
          Μεμονωμένη μέτρηση
        </button>
      </div>

      {/* --- Summary ------------------------------------------------------------------- */}
      {summary.isPending ? <Skeleton rows={2} /> : null}
      {summary.error ? (
        <ErrorState error={summary.error} onRetry={() => void summary.refetch()} />
      ) : null}

      {summary.data ? (
        <section className="summary" aria-labelledby="summary-heading">
          <h2 className="section-title" id="summary-heading">
            Τελευταίες τιμές
          </h2>

          {summary.data.latest.length === 0 ? (
            <Empty
              title="Δεν έχουν καταγραφεί μετρήσεις."
              hint="Ξεκινήστε με την πρώτη επίσκεψη."
            />
          ) : (
            <div className="summary__grid">
              {/*
                BMI comes from the server or not at all. It is null until both weight and height
                are known, and computing a stand-in here would put a number on screen that the
                server would disagree with — the one thing this architecture rules out.
              */}
              {summary.data.bmi !== null ? (
                <div className="summary__card summary__card--bmi">
                  <span className="summary__label">Δείκτης μάζας σώματος</span>
                  <span className="summary__value">{formatValue(summary.data.bmi, 1)}</span>
                  {bmiCategoryLabel(summary.data.bmiCategory) ? (
                    <span className="summary__meta">
                      {bmiCategoryLabel(summary.data.bmiCategory)}
                    </span>
                  ) : null}
                </div>
              ) : null}

              {summary.data.latest.map((measurement) => (
                <div className="summary__card" key={measurement.id}>
                  <span className="summary__label">{measurement.label}</span>
                  <span className="summary__value">
                    {formatValue(measurement.value, decimalsFor(measurement, typeIndex))}
                    <span className="summary__unit"> {measurement.unit}</span>
                  </span>
                  <span className="summary__meta">{formatDate(measurement.recordedOn)}</span>
                  <OutOfRange measurement={measurement} />
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {/* --- Change over time ---------------------------------------------------------- */}
      {measuredTypes.length > 0 ? (
        <section className="chart-section" aria-labelledby="series-heading">
          <h2 className="section-title" id="series-heading">
            Μεταβολή
          </h2>

          <div className="chart-section__picker">
            <label className="visually-hidden" htmlFor="series-type">
              Τύπος μέτρησης
            </label>
            <select
              id="series-type"
              className="field__input"
              value={seriesType ?? ''}
              onChange={(event) => setSeriesType(event.target.value || null)}
            >
              <option value="">Επιλέξτε μέτρηση…</option>
              {measuredTypes.map((code) => (
                <option key={code} value={code}>
                  {typeIndex.get(code)?.labelEl ?? code}
                </option>
              ))}
            </select>
          </div>

          {series.isPending && seriesType ? <Skeleton rows={4} /> : null}
          {series.error ? (
            <ErrorState error={series.error} onRetry={() => void series.refetch()} />
          ) : null}

          {series.data && series.data.points.length > 0 ? (
            <>
              <div className="chart-section__totals">
                <span>
                  Πρώτη: {formatWithUnit(series.data.firstValue, series.data.unit,
                    typeIndex.get(series.data.typeCode)?.decimals ?? 1)}
                </span>
                <span>
                  Τελευταία: {formatWithUnit(series.data.latestValue, series.data.unit,
                    typeIndex.get(series.data.typeCode)?.decimals ?? 1)}
                </span>
                <span>
                  Συνολική μεταβολή:{' '}
                  <strong>
                    {formatChange(series.data.totalChange,
                      typeIndex.get(series.data.typeCode)?.decimals ?? 1)}{' '}
                    {series.data.unit}
                  </strong>
                </span>
              </div>

              {series.data.points.length === 1 ? (
                <p className="chart-section__single">
                  Μία μόνο μέτρηση — χρειάζονται τουλάχιστον δύο για γράφημα μεταβολής.
                </p>
              ) : (
                <MeasurementChart
                  series={series.data}
                  decimals={typeIndex.get(series.data.typeCode)?.decimals ?? 1}
                />
              )}
            </>
          ) : null}
        </section>
      ) : null}

      {/* --- History ------------------------------------------------------------------- */}
      <section aria-labelledby="history-heading">
        <h2 className="section-title" id="history-heading">
          Ιστορικό
        </h2>

        {history.isPending ? <Skeleton rows={5} /> : null}
        {history.error ? (
          <ErrorState error={history.error} onRetry={() => void history.refetch()} />
        ) : null}

        {remove.error ? (
          <p className="form-error" role="alert">
            {messageFor(remove.error)}
          </p>
        ) : null}

        {history.data && history.data.content.length > 0 ? (
          <>
            <div className="table-scroll">
              <table className="table">
                <caption className="visually-hidden">Ιστορικό μετρήσεων</caption>
                <thead>
                  <tr>
                    <th scope="col">Ημερομηνία</th>
                    <th scope="col">Μέτρηση</th>
                    <th scope="col">Τιμή</th>
                    <th scope="col">Σημείωση</th>
                    <th scope="col">
                      <span className="visually-hidden">Ενέργειες</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {orderForDisplay(history.data.content, types.data).map((measurement) => (
                    <tr key={measurement.id}>
                      <td>{formatDate(measurement.recordedOn)}</td>
                      <th scope="row">{measurement.label}</th>
                      <td>
                        {formatValue(measurement.value, decimalsFor(measurement, typeIndex))}{' '}
                        {measurement.unit}
                        <OutOfRange measurement={measurement} />
                      </td>
                      <td className="measurement__note">{measurement.notes ?? '—'}</td>
                      <td>
                        <button
                          type="button"
                          className="button button--link"
                          onClick={() => setDeleting(measurement.id)}
                        >
                          {strings.common.delete}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              page={history.data.page}
              totalPages={history.data.totalPages}
              totalElements={history.data.totalElements}
              onChange={setPage}
              busy={history.isFetching}
              noun="μετρήσεις"
            />
          </>
        ) : null}
      </section>

      <ConfirmDialog
        open={deleting !== null}
        destructive
        busy={remove.isPending}
        title="Διαγραφή μέτρησης"
        body="Η μέτρηση θα διαγραφεί οριστικά και θα αφαιρεθεί από το ιστορικό και τα γραφήματα."
        confirmLabel={strings.common.delete}
        onCancel={() => setDeleting(null)}
        onConfirm={() =>
          deleting !== null &&
          remove.mutate(deleting, { onSettled: () => setDeleting(null) })
        }
      />
    </>
  );
}

/**
 * Marks a reading outside its reference range.
 *
 * Three states, not two: `true`, `false`, and `null` for a type that defines no range at all.
 * Null is not "in range" — it is "there is nothing to compare against" — so it shows nothing.
 *
 * Never colour alone. The word and the symbol carry the meaning; the colour reinforces it. As it
 * happens no seeded measurement type has a reference range yet, so this does not currently fire
 * for any of the fourteen — it is here for the blood markers the roadmap adds.
 */
function OutOfRange({ measurement }: { measurement: { outOfRange: boolean | null } }) {
  if (measurement.outOfRange !== true) {
    return null;
  }

  return (
    <span className="out-of-range">
      <span aria-hidden="true">⚠ </span>
      εκτός εύρους
    </span>
  );
}
