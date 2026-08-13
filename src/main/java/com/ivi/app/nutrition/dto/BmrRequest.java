package com.ivi.app.nutrition.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record BmrRequest(

    @NotNull(message = "Equation is required")
    BmrEquation equation,

    @NotNull(message = "Sex is required")
    Sex sex,

    @NotNull(message = "Weight is required")
    @DecimalMin(value = "20.0", message = "Weight must be at least 20 kg")
    @DecimalMax(value = "400.0", message = "Weight must be at most 400 kg")
    BigDecimal weightKg,

    @NotNull(message = "Height is required")
    @DecimalMin(value = "80.0", message = "Height must be at least 80 cm")
    @DecimalMax(value = "250.0", message = "Height must be at most 250 cm")
    BigDecimal heightCm,

    @NotNull(message = "Age is required")
    @Min(value = 1, message = "Age must be at least 1")
    @Max(value = 120, message = "Age must be at most 120")
    Integer ageYears
) {}
