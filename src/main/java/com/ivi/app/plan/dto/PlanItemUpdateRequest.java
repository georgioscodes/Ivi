package com.ivi.app.plan.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record PlanItemUpdateRequest(

    @DecimalMin(value = "0.001", message = "Quantity must be greater than zero")
    BigDecimal quantity,

    /** Replaces the printed name, e.g. a cut of meat rather than the generic catalogue entry. */
    @Size(max = 200, message = "Name must be at most 200 characters")
    String nameOverride
) {}
