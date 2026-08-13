package com.ivi.app.plan.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record PlanCreateRequest(

    @NotNull(message = "Client is required")
    Long clientId,

    @NotBlank(message = "Plan name is required")
    @Size(max = 200, message = "Name must be at most 200 characters")
    String name,

    @NotNull(message = "Energy target is required")
    @DecimalMin(value = "400.0", message = "Energy target must be at least 400 kcal")
    BigDecimal targetKcal,

    @NotNull(message = "Protein target is required")
    @DecimalMin(value = "0.0", message = "Protein target cannot be negative")
    BigDecimal targetProteinG,

    @NotNull(message = "Carbohydrate target is required")
    @DecimalMin(value = "0.0", message = "Carbohydrate target cannot be negative")
    BigDecimal targetCarbohydrateG,

    @NotNull(message = "Fat target is required")
    @DecimalMin(value = "0.0", message = "Fat target cannot be negative")
    BigDecimal targetFatG,

    String basis,

    BigDecimal activityFactor,

    /**
     * How many days to scaffold, each with the standard set of meals. Seven for a literal week,
     * one for a single-day plan the client repeats.
     */
    @NotNull(message = "Day count is required")
    @Min(value = 1, message = "A plan needs at least one day")
    @Max(value = 31, message = "A plan can span at most 31 days")
    Integer dayCount
) {}
