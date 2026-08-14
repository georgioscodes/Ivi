package com.ivi.app.plan.dto;

import jakarta.validation.constraints.Size;

/**
 * The practitioner's notes on a plan — the instructions that accompany the food, and the section
 * a client reads first when the PDF reaches them.
 *
 * <p>Nullable and blankable: clearing the notes is a legitimate edit, and an empty value removes
 * the section from the export rather than printing an empty heading.
 */
public record PlanNotesRequest(

    @Size(max = 4000, message = "Notes must be at most 4000 characters")
    String notes
) {}
