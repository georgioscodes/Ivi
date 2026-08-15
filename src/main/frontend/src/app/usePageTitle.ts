import { useEffect } from 'react';

import { strings } from '@/strings';

/**
 * Names the page in the browser tab, the history entry and the bookmark.
 *
 * Every route rendered as "Ivi" until this existed, which makes the back button, a row of open
 * tabs and the history list equally useless — and means a screen reader announces the same word
 * after every navigation, with nothing to say where the user has arrived. WCAG 2.4.2.
 *
 * **Deliberately never the client's name.** The obvious descriptive title would be "Μαρία
 * Παπαδοπούλου · Ivi", and it is the wrong call here: the document title goes into browser
 * history, the OS window title and the task switcher, so a named person receiving dietetic care
 * would end up written into places this application does not control and cannot erase. Naming the
 * *kind* of page satisfies the guideline; naming the person would leak Article 9 data into the
 * desktop.
 */
export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · ${strings.app.name}`;
    return () => {
      document.title = strings.app.name;
    };
  }, [title]);
}
