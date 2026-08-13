package com.ivi.app.nutrition.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record MacroDistributionRequest(

    @NotNull(message = "Target energy is required")
    @DecimalMin(value = "400.0", message = "Target energy must be at least 400 kcal")
    @DecimalMax(value = "10000.0", message = "Target energy must be at most 10000 kcal")
    BigDecimal targetKcal,

    @NotNull(message = "Carbohydrate percentage is required")
    @DecimalMin(value = "0.0", message = "Percentage cannot be negative")
    @DecimalMax(value = "100.0", message = "Percentage cannot exceed 100")
    BigDecimal carbohydratePercent,

    @NotNull(message = "Protein percentage is required")
    @DecimalMin(value = "0.0", message = "Percentage cannot be negative")
    @DecimalMax(value = "100.0", message = "Percentage cannot exceed 100")
    BigDecimal proteinPercent,

    @NotNull(message = "Fat percentage is required")
    @DecimalMin(value = "0.0", message = "Percentage cannot be negative")
    @DecimalMax(value = "100.0", message = "Percentage cannot exceed 100")
    BigDecimal fatPercent
) {}
