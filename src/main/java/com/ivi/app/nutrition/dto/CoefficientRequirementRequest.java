package com.ivi.app.nutrition.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

/**
 * The other way practitioners reach a target: prescribe grams per kilogram of body mass for each
 * macronutrient and let the energy fall out of the sum, rather than fixing energy first and
 * splitting it by percentage. Common in sports and clinical work, where protein is prescribed
 * per kilogram and the rest follows.
 */
public record CoefficientRequirementRequest(

    @NotNull(message = "Weight is required")
    @DecimalMin(value = "20.0", message = "Weight must be at least 20 kg")
    @DecimalMax(value = "400.0", message = "Weight must be at most 400 kg")
    BigDecimal weightKg,

    @NotNull(message = "Carbohydrate coefficient is required")
    @DecimalMin(value = "0.0", message = "Coefficient cannot be negative")
    @DecimalMax(value = "20.0", message = "Coefficient must be at most 20 g/kg")
    BigDecimal carbohydrateGPerKg,

    @NotNull(message = "Protein coefficient is required")
    @DecimalMin(value = "0.0", message = "Coefficient cannot be negative")
    @DecimalMax(value = "10.0", message = "Coefficient must be at most 10 g/kg")
    BigDecimal proteinGPerKg,

    @NotNull(message = "Fat coefficient is required")
    @DecimalMin(value = "0.0", message = "Coefficient cannot be negative")
    @DecimalMax(value = "10.0", message = "Coefficient must be at most 10 g/kg")
    BigDecimal fatGPerKg
) {}
