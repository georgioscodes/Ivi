package com.ivi.app.plan.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record PlanItemAddRequest(

    @NotNull(message = "Food is required")
    Long foodId,

    /** Which portion to use. Omitted means the food's default portion. */
    Long portionId,

    @NotNull(message = "Quantity is required")
    @DecimalMin(value = "0.001", message = "Quantity must be greater than zero")
    BigDecimal quantity
) {}
