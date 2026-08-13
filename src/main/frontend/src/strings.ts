/**
 * Greek UI copy, in one module.
 *
 * No i18n library. Almost every label a practitioner reads is data, not chrome — measurement type
 * names, food names, meal names and category names all arrive from the API with their Greek
 * already attached. What is left is this: buttons, states, and the sentences shown when something
 * goes wrong. Keeping it collected costs nothing now and is the whole job if a second language is
 * ever needed.
 *
 * Error copy is written to say what happened and what to do. "Σφάλμα" on its own tells a
 * practitioner with a client in front of them nothing they can act on.
 */
export const strings = {
  app: {
    name: 'Ivi',
    tagline: 'Λογισμικό διαχείρισης διαιτολογικού γραφείου',
  },

  common: {
    save: 'Αποθήκευση',
    saving: 'Αποθήκευση…',
    saved: 'Αποθηκεύτηκε',
    cancel: 'Ακύρωση',
    delete: 'Διαγραφή',
    edit: 'Επεξεργασία',
    add: 'Προσθήκη',
    search: 'Αναζήτηση',
    loading: 'Φόρτωση…',
    retry: 'Δοκιμάστε ξανά',
    reload: 'Ανανέωση',
    close: 'Κλείσιμο',
    confirm: 'Επιβεβαίωση',
    back: 'Πίσω',
  },

  auth: {
    signIn: 'Σύνδεση',
    signOut: 'Αποσύνδεση',
    email: 'Email',
    password: 'Κωδικός πρόσβασης',
    displayName: 'Ονοματεπώνυμο',
    practiceName: 'Επωνυμία γραφείου',
    register: 'Δημιουργία λογαριασμού',
    // Deliberately does not say which of the two was wrong; that would confirm an email exists.
    invalidCredentials: 'Λανθασμένο email ή κωδικός πρόσβασης.',
    sessionExpired: 'Η συνεδρία σας έληξε. Συνδεθείτε ξανά για να συνεχίσετε.',
    rateLimited: 'Πολλές προσπάθειες σύνδεσης. Δοκιμάστε ξανά σε λίγα λεπτά.',
  },

  errors: {
    network: 'Δεν υπάρχει σύνδεση με τον διακομιστή. Ελέγξτε το δίκτυό σας.',
    server: 'Κάτι πήγε στραβά από την πλευρά μας. Η αλλαγή σας δεν αποθηκεύτηκε.',
    notFound: 'Δεν βρέθηκε.',
    // The plan builder's 409. The practitioner needs to know their edit did not apply, and that
    // reloading will not lose anything already saved.
    conflict: 'Το πλάνο άλλαξε αλλού. Ανανεώστε για να δείτε την τρέχουσα έκδοση.',
    validation: 'Ελέγξτε τα πεδία που επισημαίνονται.',
    unexpected: 'Παρουσιάστηκε απρόσμενο σφάλμα.',
  },

  empty: {
    noResults: 'Δεν βρέθηκαν αποτελέσματα.',
    noResultsHint: 'Δοκιμάστε διαφορετικό όρο αναζήτησης.',
  },
} as const;
