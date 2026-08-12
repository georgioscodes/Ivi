package com.ivi.app.food.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record FoodPortionRequest(

    @NotBlank(message = "Portion label is required")
    @Size(max = 80, message = "Portion label must be at most 80 characters")
    String label,

    @NotNull(message = "Portion weight is required")
    @DecimalMin(value = "0.01", message = "Portion weight must be greater than zero")
    BigDecimal grams,

    boolean isDefault
) {}
