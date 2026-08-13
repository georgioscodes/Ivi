package com.ivi.app.audit.model;

public enum AuditAction {
    READ,
    CREATE,
    UPDATE,
    DELETE,

    /** The data left the system — a PDF downloaded, a record exported. */
    EXPORT
}
