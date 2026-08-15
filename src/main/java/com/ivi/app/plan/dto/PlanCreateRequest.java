package com.ivi.app.plan.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
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

    /** VARCHAR(40) in V6__plan.sql. Unbounded here meant a long value became a 500. */
    @Size(max = 40, message = "Basis must be at most 40 characters")
    String basis,

    /*
     * NUMERIC(4,3) — one digit before the point, three after. The multipliers this holds are the
     * standard activity factors, which live between 1.2 and 1.9; anything outside that is a typo
     * rather than a plan, and without the bound it reached the database and came back a 500.
     */
    @DecimalMin(value = "1.0", message = "Activity factor must be at least 1.0")
    @DecimalMax(value = "9.999", message = "Activity factor must be at most 9.999")
    @Digits(integer = 1, fraction = 3, message = "Activity factor allows three decimal places")
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
