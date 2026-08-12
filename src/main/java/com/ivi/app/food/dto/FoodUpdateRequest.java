package com.ivi.app.food.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.List;

/**
 * Applied to a food the practitioner owns, or used to create an override of a catalogue food.
 * Which of the two happens depends on the target, not on the request.
 */
public record FoodUpdateRequest(

    @NotBlank(message = "Greek name is required")
    @Size(max = 200, message = "Name must be at most 200 characters")
    String nameEl,

    @Size(max = 200, message = "Name must be at most 200 characters")
    String nameEn,

    @NotBlank(message = "Category is required")
    @Pattern(regexp = "FRESH|CARBOHYDRATE|PROTEIN|FAT|COMPOSITE",
             message = "Category must be one of FRESH, CARBOHYDRATE, PROTEIN, FAT, COMPOSITE")
    String category,

    @NotNull(message = "Energy is required")
    @DecimalMin(value = "0.0", message = "Energy cannot be negative")
    BigDecimal energyKcal,

    @NotNull(message = "Protein is required")
    @DecimalMin(value = "0.0", message = "Protein cannot be negative")
    BigDecimal proteinG,

    @NotNull(message = "Carbohydrate is required")
    @DecimalMin(value = "0.0", message = "Carbohydrate cannot be negative")
    BigDecimal carbohydrateG,

    @NotNull(message = "Fat is required")
    @DecimalMin(value = "0.0", message = "Fat cannot be negative")
    BigDecimal fatG,

    @Valid
    List<FoodPortionRequest> portions
) {}
