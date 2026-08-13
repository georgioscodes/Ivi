package com.ivi.app.nutrition.dto;

import java.math.BigDecimal;

/**
 * Every step is returned, not just the final number, so the practitioner can see how the target
 * was arrived at and explain it to the client. A single figure with no derivation is not
 * defensible in a consultation.
 */
public record EnergyRequirementResponse(

    /** Basal rate used, whether computed or supplied. Null when the target was stated directly. */
    BigDecimal bmrKcal,

    /** How the basal rate was arrived at: an equation name, MANUAL, or DIRECT. */
    String basis,

    BigDecimal activityFactor,

    /** Energy to hold body mass steady: basal rate times activity factor. */
    BigDecimal maintenanceKcal,

    /** Daily adjustment implied by the weight goal. Negative for loss. */
    BigDecimal weightGoalAdjustmentKcal,

    /** What the plan should be built to. */
    BigDecimal targetKcal
) {}
