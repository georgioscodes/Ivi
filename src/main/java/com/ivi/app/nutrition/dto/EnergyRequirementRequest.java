package com.ivi.app.nutrition.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;

import java.math.BigDecimal;

/**
 * Energy requirement, expressed as a choice between three entry paths.
 *
 * <p>Exactly one of these must be supplied, and the service rejects any other combination:
 *
 * <ol>
 *   <li>{@code bmr} — compute basal rate from anthropometrics;</li>
 *   <li>{@code manualBmrKcal} — the practitioner already has a measured or preferred basal rate,
 *       typically from indirect calorimetry or a body-composition device;</li>
 *   <li>{@code manualEnergyKcal} — the practitioner is simply stating the target, e.g. "a 2000
 *       kcal plan", in which case activity and weight goal are not applied at all.</li>
 * </ol>
 */
public record EnergyRequirementRequest(

    @Valid
    BmrRequest bmr,

    @DecimalMin(value = "400.0", message = "Basal rate must be at least 400 kcal")
    @DecimalMax(value = "5000.0", message = "Basal rate must be at most 5000 kcal")
    BigDecimal manualBmrKcal,

    @DecimalMin(value = "400.0", message = "Energy must be at least 400 kcal")
    @DecimalMax(value = "10000.0", message = "Energy must be at most 10000 kcal")
    BigDecimal manualEnergyKcal,

    /**
     * Physical activity level. Free-form rather than a fixed set: practitioners routinely use
     * values between the textbook presets, such as 1.25 for ordinary daily activity.
     */
    @DecimalMin(value = "1.0", message = "Activity factor must be at least 1.0")
    @DecimalMax(value = "3.0", message = "Activity factor must be at most 3.0")
    BigDecimal activityFactor,

    /**
     * Intended change in body mass over {@code periodDays}, in kilograms.
     *
     * <p><strong>Negative means loss.</strong> A request to lose 1.5 kg is {@code -1.5}, which
     * lowers the target; a positive value raises it. The sign convention is stated here because
     * it is exactly the sort of thing that silently inverts.
     */
    @DecimalMin(value = "-10.0", message = "Weight change must be at least -10 kg per period")
    @DecimalMax(value = "10.0", message = "Weight change must be at most 10 kg per period")
    BigDecimal targetWeightChangeKg,

    @Min(value = 1, message = "Period must be at least one day")
    Integer periodDays
) {}
