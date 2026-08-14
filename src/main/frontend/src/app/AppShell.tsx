import { NavLink, Outlet } from 'react-router-dom';

import { useLogout, useSession } from '@/session/session';
import { strings } from '@/strings';
import './shell.css';

/**
 * The frame every signed-in screen sits in.
 */
export function AppShell() {
  const { practitioner } = useSession();
  const logout = useLogout();

  return (
    <div className="shell">
      <header className="shell__header">
        <span className="shell__brand">{strings.app.name}</span>

        {/* Two top-level areas: the practitioner's clients, and the food catalogue they build
            plans from. aria-current marks the active one for assistive technology; weight and an
            underline mark it visually, so it is never colour alone. */}
        <nav className="shell__nav" aria-label="Κύρια πλοήγηση">
          <NavLink
            to="/"
            end
            className={({ isActive }) => `shell__link${isActive ? ' shell__link--active' : ''}`}
          >
            Πελάτες
          </NavLink>
          <NavLink
            to="/food"
            className={({ isActive }) => `shell__link${isActive ? ' shell__link--active' : ''}`}
          >
            Τρόφιμα
          </NavLink>
        </nav>

        <div className="shell__account">
          {practitioner ? (
            <span className="shell__who">
              {practitioner.displayName}
              {practitioner.practiceName ? (
                <span className="shell__practice"> · {practitioner.practiceName}</span>
              ) : null}
            </span>
          ) : null}

          <button
            type="button"
            className="button button--secondary shell__signout"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
          >
            {strings.auth.signOut}
          </button>
        </div>
      </header>

      <main className="shell__main">
        <Outlet />
      </main>
    </div>
  );
}
