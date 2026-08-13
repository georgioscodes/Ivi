package com.ivi.app.plan.model;

public enum PlanStatus {
    /** Being worked on. Freely editable. */
    DRAFT,

    /** Handed to the client. Still editable, but it is now a document someone is following. */
    ISSUED,

    /** Superseded. Kept because it is part of the clinical record. */
    ARCHIVED
}
