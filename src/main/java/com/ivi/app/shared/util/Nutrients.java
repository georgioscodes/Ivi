package com.ivi.app.shared.util;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * The rounding contract for every nutrient figure in the system.
 *
 * <p>Lives in {@code shared} rather than in one module because it is a system-wide contract, not
 * a helper: the plan builder computes the same totals in the browser, and the two implementations
 * have to agree digit for digit or the user watches the number change when they hit save. This
 * class is the Java half of that contract and the frontend must mirror it exactly.
 *
 * <p>Two rules underpin it:
 *
 * <ul>
 *   <li><strong>BigDecimal, never double.</strong> Floating-point drift accumulated over hundreds
 *       of additions in a week-long plan is large enough to see.</li>
 *   <li><strong>Round only at display.</strong> Intermediate values keep their precision;
 *       rounding between accumulation steps compounds the error it is meant to avoid.</li>
 * </ul>
 */
public final class Nutrients {

    /** Atwater factors, in kilocalories per gram. */
    public static final BigDecimal KCAL_PER_G_PROTEIN = new BigDecimal("4");
    public static final BigDecimal KCAL_PER_G_CARBOHYDRATE = new BigDecimal("4");
    public static final BigDecimal KCAL_PER_G_FAT = new BigDecimal("9");

    /**
     * Kilocalories per kilogram of body mass, the constant behind planned weight change.
     *
     * <p>A long-standing planning convention rather than a physiological constant: real energy
     * balance is adaptive and this over-predicts loss over long horizons. It is used because it
     * is what practitioners expect the arithmetic to produce.
     */
    public static final BigDecimal KCAL_PER_KG_BODY_MASS = new BigDecimal("7700");

    /** Working precision for intermediate steps, well beyond anything displayed. */
    public static final int WORKING_SCALE = 6;

    private Nutrients() {
        // Utility class — no instantiation
    }

    /** Energy is shown as a whole number of kilocalories. */
    public static BigDecimal roundEnergy(BigDecimal kcal) {
        return kcal.setScale(0, RoundingMode.HALF_UP);
    }

    /** Macronutrient masses are shown to one decimal place. */
    public static BigDecimal roundMacro(BigDecimal grams) {
        return grams.setScale(1, RoundingMode.HALF_UP);
    }

    /** Percentages are shown to one decimal place. */
    public static BigDecimal roundPercent(BigDecimal percent) {
        return percent.setScale(1, RoundingMode.HALF_UP);
    }

    /** Division at working precision, for use between accumulation steps. */
    public static BigDecimal divide(BigDecimal dividend, BigDecimal divisor) {
        return dividend.divide(divisor, WORKING_SCALE, RoundingMode.HALF_UP);
    }
}
