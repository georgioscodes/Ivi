import { BrowserRouter, Link, Route, Routes, useLocation } from 'react-router-dom';

import { AppShell } from '@/app/AppShell';
import { GuestOnlyRoute, ProtectedRoute } from '@/app/ProtectedRoute';
import { Empty } from '@/components/states';
import { ClientDetailPage, ClientOverviewTab } from '@/features/client/ClientDetailPage';
import { ClientFormPage } from '@/features/client/ClientFormPage';
import { ClientListPage } from '@/features/client/ClientListPage';
import { FoodCataloguePage } from '@/features/food/FoodCataloguePage';
import { FoodDetailPage } from '@/features/food/FoodDetailPage';
import { FoodFormPage } from '@/features/food/FoodFormPage';
import { SuggestionsPage } from '@/features/food/SuggestionsPage';
import { JournalTab } from '@/features/journal/JournalTab';
import { MeasurementsTab } from '@/features/measurement/MeasurementsTab';
import { TargetsTab } from '@/features/nutrition/TargetsTab';
import { PlanPage } from '@/features/plan/PlanPage';
import { PlansTab } from '@/features/plan/PlansTab';
import { LoginPage } from '@/features/auth/LoginPage';
import { RegisterPage } from '@/features/auth/RegisterPage';
import { useSessionExpiryHandler } from '@/session/session';
import { strings } from '@/strings';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            <GuestOnlyRoute>
              <LoginPage />
            </GuestOnlyRoute>
          }
        />
        <Route
          path="/register"
          element={
            <GuestOnlyRoute>
              <RegisterPage />
            </GuestOnlyRoute>
          }
        />

        <Route
          element={
            <ProtectedRoute>
              <SessionAwareShell />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<ClientListPage />} />
          <Route path="/food" element={<FoodCataloguePage />} />
          <Route path="/food/new" element={<FoodFormPage mode="create" />} />
          {/* Before /food/:foodId, or "suggestions" would be read as a food id. */}
          <Route path="/food/suggestions" element={<SuggestionsPage />} />
          <Route path="/food/:foodId" element={<FoodDetailPage />} />
          <Route path="/food/:foodId/edit" element={<FoodFormPage mode="edit" />} />

          <Route path="/client/new" element={<ClientFormPage mode="create" />} />
          <Route path="/client/:clientId/edit" element={<ClientFormPage mode="edit" />} />

          {/* Its own page, not a tab panel: building a plan is the longest task in the
              application and it needs the full width. */}
          <Route path="/client/:clientId/plan/:planId" element={<PlanPage />} />

          <Route path="/client/:clientId" element={<ClientDetailPage />}>
            <Route index element={<ClientOverviewTab />} />
            <Route path="measurements" element={<MeasurementsTab />} />
            <Route path="targets" element={<TargetsTab />} />
            <Route path="plans" element={<PlansTab />} />
            <Route path="journal" element={<JournalTab />} />
          </Route>

          {/*
            Inside the protected tree rather than a redirect to "/", so an unknown path is
            authenticated first and the URL survives. A catch-all that bounces to the home page
            runs before ProtectedRoute, which means a signed-out practitioner following a link
            loses the destination they were sent — they sign in and arrive somewhere else, with
            nothing to say what happened.
          */}
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

/**
 * The expiry handler lives inside the protected tree so it is mounted exactly while there is a
 * session to lose. Sessions are server-side and revocable, so an expiry can arrive at any moment
 * from any request; without this the shell keeps rendering while every panel under it fails,
 * which looks like a broken application rather than a session that ended.
 */
function SessionAwareShell() {
  useSessionExpiryHandler();
  return <AppShell />;
}

function NotFound() {
  const location = useLocation();

  return (
    <Empty
      title="Η σελίδα δεν βρέθηκε."
      hint={`Η διεύθυνση ${location.pathname} δεν αντιστοιχεί σε κάποια οθόνη.`}
      action={
        <Link className="button button--secondary" to="/">
          {strings.common.back}
        </Link>
      }
    />
  );
}

