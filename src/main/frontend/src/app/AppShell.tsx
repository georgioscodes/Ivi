import { Outlet } from 'react-router-dom';

import { useLogout, useSession } from '@/session/session';
import { strings } from '@/strings';
import './shell.css';

/**
 * The frame every signed-in screen sits in. Navigation arrives with the client list in Block 3.
 */
export function AppShell() {
  const { practitioner } = useSession();
  const logout = useLogout();

  return (
    <div className="shell">
      <header className="shell__header">
        <span className="shell__brand">{strings.app.name}</span>

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
