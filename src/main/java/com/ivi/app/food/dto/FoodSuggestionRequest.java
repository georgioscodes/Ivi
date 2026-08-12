package com.ivi.app.food.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

/**
 * Every proposed field is optional: a practitioner may be confident about one number and have
 * no opinion on the rest. A null means "no change proposed", not "set to nothing".
 */
public record FoodSuggestionRequest(

    @Size(max = 200, message = "Name must be at most 200 characters")
    String proposedNameEl,

    @DecimalMin(value = "0.0", message = "Energy cannot be negative")
    BigDecimal proposedEnergyKcal,

    @DecimalMin(value = "0.0", message = "Protein cannot be negative")
    BigDecimal proposedProteinG,

    @DecimalMin(value = "0.0", message = "Carbohydrate cannot be negative")
    BigDecimal proposedCarbohydrateG,

    @DecimalMin(value = "0.0", message = "Fat cannot be negative")
    BigDecimal proposedFatG,

    @Size(max = 2000, message = "Rationale must be at most 2000 characters")
    String rationale
) {}
