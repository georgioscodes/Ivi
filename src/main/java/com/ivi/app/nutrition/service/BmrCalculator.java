package com.ivi.app.nutrition.service;

import com.ivi.app.nutrition.dto.BmrEquation;
import com.ivi.app.nutrition.dto.BmrRequest;
import com.ivi.app.nutrition.dto.Sex;

import java.math.BigDecimal;

/**
 * Basal metabolic rate from the published predictive equations.
 *
 * <p>Package-private: the nutrition service is the module's only entry point, and nothing outside
 * it has any business selecting an equation directly.
 *
 * <p>Coefficients are written as {@code BigDecimal} string literals rather than doubles so the
 * arithmetic is exact and reproducible against a reference implementation.
 */
final class BmrCalculator {

    private BmrCalculator() {
        // Utility class — no instantiation
    }

    static BigDecimal calculate(BmrRequest request) {
        return switch (request.equation()) {
            case HARRIS_BENEDICT_ORIGINAL -> harrisBenedictOriginal(request);
            case HARRIS_BENEDICT_REVISED -> harrisBenedictRevised(request);
            case MIFFLIN_ST_JEOR -> mifflinStJeor(request);
        };
    }

    /** Harris & Benedict, 1919. */
    private static BigDecimal harrisBenedictOriginal(BmrRequest r) {
        return r.sex() == Sex.MALE
            ? term("66.4730", "13.7516", "5.0033", "6.7550", r)
            : term("655.0955", "9.5634", "1.8496", "4.6756", r);
    }

    /** Roza & Shizgal, 1984 — the revision of Harris-Benedict in common use. */
    private static BigDecimal harrisBenedictRevised(BmrRequest r) {
        return r.sex() == Sex.MALE
            ? term("88.362", "13.397", "4.799", "5.677", r)
            : term("447.593", "9.247", "3.098", "4.330", r);
    }

    /** Mifflin-St Jeor, 1990. Constant differs by sex; the coefficients do not. */
    private static BigDecimal mifflinStJeor(BmrRequest r) {
        BigDecimal base = new BigDecimal("10").multiply(r.weightKg())
            .add(new BigDecimal("6.25").multiply(r.heightCm()))
            .subtract(new BigDecimal("5").multiply(BigDecimal.valueOf(r.ageYears())));

        return r.sex() == Sex.MALE
            ? base.add(new BigDecimal("5"))
            : base.subtract(new BigDecimal("161"));
    }

    /** constant + (weightCoefficient × kg) + (heightCoefficient × cm) − (ageCoefficient × years) */
    private static BigDecimal term(String constant, String weightCoefficient,
                                   String heightCoefficient, String ageCoefficient, BmrRequest r) {
        return new BigDecimal(constant)
            .add(new BigDecimal(weightCoefficient).multiply(r.weightKg()))
            .add(new BigDecimal(heightCoefficient).multiply(r.heightCm()))
            .subtract(new BigDecimal(ageCoefficient).multiply(BigDecimal.valueOf(r.ageYears())));
    }

    static String describe(BmrEquation equation) {
        return switch (equation) {
            case HARRIS_BENEDICT_ORIGINAL -> "HARRIS_BENEDICT_ORIGINAL";
            case HARRIS_BENEDICT_REVISED -> "HARRIS_BENEDICT_REVISED";
            case MIFFLIN_ST_JEOR -> "MIFFLIN_ST_JEOR";
        };
    }
}
