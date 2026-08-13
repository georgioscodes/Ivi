package com.ivi.app.nutrition.service;

import com.ivi.app.nutrition.dto.ActivityLevelResponse;
import com.ivi.app.nutrition.dto.BmrRequest;
import com.ivi.app.nutrition.dto.BmrResponse;
import com.ivi.app.nutrition.dto.CoefficientRequirementRequest;
import com.ivi.app.nutrition.dto.EnergyRequirementRequest;
import com.ivi.app.nutrition.dto.EnergyRequirementResponse;
import com.ivi.app.nutrition.dto.MacroDistributionRequest;
import com.ivi.app.nutrition.dto.MacroDistributionResponse;
import com.ivi.app.shared.exception.BusinessException;
import com.ivi.app.shared.util.Nutrients;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.List;

/**
 * Energy and macronutrient calculations.
 *
 * <p>The module has no entity and no repository: these are pure functions of their inputs, and
 * the results are persisted by the plan that uses them. That makes the whole module trivially
 * testable and keeps the plan module from absorbing the arithmetic.
 */
@Service
public class NutritionService {

    private static final BigDecimal HUNDRED = new BigDecimal("100");
    private static final int DEFAULT_PERIOD_DAYS = 30;

    public BmrResponse calculateBmr(BmrRequest request) {
        return new BmrResponse(
            Nutrients.roundEnergy(BmrCalculator.calculate(request)),
            BmrCalculator.describe(request.equation())
        );
    }

    /**
     * Resolves a daily energy target by whichever of the three entry paths the request selects.
     *
     * <p>Every intermediate value is returned alongside the answer so the practitioner can show
     * their working. Rounding happens once, on the way out.
     */
    public EnergyRequirementResponse calculateEnergyRequirement(EnergyRequirementRequest request) {
        validateExactlyOneBasis(request);

        // Path 3: the target is stated outright, so activity and weight goal do not apply.
        if (request.manualEnergyKcal() != null) {
            return new EnergyRequirementResponse(
                null,
                "DIRECT",
                null,
                Nutrients.roundEnergy(request.manualEnergyKcal()),
                BigDecimal.ZERO.setScale(0),
                Nutrients.roundEnergy(request.manualEnergyKcal())
            );
        }

        BigDecimal bmr;
        String basis;
        if (request.bmr() != null) {
            bmr = BmrCalculator.calculate(request.bmr());
            basis = BmrCalculator.describe(request.bmr().equation());
        } else {
            bmr = request.manualBmrKcal();
            basis = "MANUAL";
        }

        BigDecimal activityFactor = request.activityFactor();
        if (activityFactor == null) {
            throw new BusinessException(
                "An activity factor is required when the target is derived from a basal rate");
        }

        BigDecimal maintenance = bmr.multiply(activityFactor);
        BigDecimal adjustment = weightGoalAdjustment(request);
        BigDecimal target = maintenance.add(adjustment);

        if (target.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException(
                "That weight goal produces a non-positive energy target. Reduce the rate of change "
                    + "or lengthen the period.");
        }

        return new EnergyRequirementResponse(
            Nutrients.roundEnergy(bmr),
            basis,
            activityFactor,
            Nutrients.roundEnergy(maintenance),
            Nutrients.roundEnergy(adjustment),
            Nutrients.roundEnergy(target)
        );
    }

    /**
     * Splits an energy target into macronutrient masses.
     *
     * <p>Percentages must total 100. A tenth of a percent of slack is allowed, because the client
     * arrives at these with sliders and 33.3 + 33.3 + 33.4 is a reasonable thing to send.
     */
    public MacroDistributionResponse distributeMacros(MacroDistributionRequest request) {
        BigDecimal total = request.carbohydratePercent()
            .add(request.proteinPercent())
            .add(request.fatPercent());

        if (total.subtract(HUNDRED).abs().compareTo(new BigDecimal("0.1")) > 0) {
            throw new BusinessException(
                "Macronutrient percentages must total 100, but total " + total.stripTrailingZeros().toPlainString());
        }

        BigDecimal carbKcal = share(request.targetKcal(), request.carbohydratePercent());
        BigDecimal proteinKcal = share(request.targetKcal(), request.proteinPercent());
        BigDecimal fatKcal = share(request.targetKcal(), request.fatPercent());

        return new MacroDistributionResponse(
            Nutrients.roundEnergy(request.targetKcal()),
            Nutrients.roundMacro(Nutrients.divide(carbKcal, Nutrients.KCAL_PER_G_CARBOHYDRATE)),
            Nutrients.roundMacro(Nutrients.divide(proteinKcal, Nutrients.KCAL_PER_G_PROTEIN)),
            Nutrients.roundMacro(Nutrients.divide(fatKcal, Nutrients.KCAL_PER_G_FAT)),
            Nutrients.roundEnergy(carbKcal),
            Nutrients.roundEnergy(proteinKcal),
            Nutrients.roundEnergy(fatKcal)
        );
    }

    /**
     * The inverse of {@link #distributeMacros}: prescribe grams per kilogram and let the energy
     * total fall out, rather than fixing energy first.
     */
    public MacroDistributionResponse calculateFromCoefficients(CoefficientRequirementRequest request) {
        BigDecimal carbG = request.carbohydrateGPerKg().multiply(request.weightKg());
        BigDecimal proteinG = request.proteinGPerKg().multiply(request.weightKg());
        BigDecimal fatG = request.fatGPerKg().multiply(request.weightKg());

        BigDecimal carbKcal = carbG.multiply(Nutrients.KCAL_PER_G_CARBOHYDRATE);
        BigDecimal proteinKcal = proteinG.multiply(Nutrients.KCAL_PER_G_PROTEIN);
        BigDecimal fatKcal = fatG.multiply(Nutrients.KCAL_PER_G_FAT);
        BigDecimal totalKcal = carbKcal.add(proteinKcal).add(fatKcal);

        if (totalKcal.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException("Those coefficients produce no energy at all");
        }

        return new MacroDistributionResponse(
            Nutrients.roundEnergy(totalKcal),
            Nutrients.roundMacro(carbG),
            Nutrients.roundMacro(proteinG),
            Nutrients.roundMacro(fatG),
            Nutrients.roundEnergy(carbKcal),
            Nutrients.roundEnergy(proteinKcal),
            Nutrients.roundEnergy(fatKcal)
        );
    }

    /** Suggested activity factors. The calculation accepts any value in range, not only these. */
    public List<ActivityLevelResponse> activityLevels() {
        return List.of(
            new ActivityLevelResponse("SEDENTARY", new BigDecimal("1.2"),
                "Καθιστική ζωή", "Sedentary"),
            new ActivityLevelResponse("TYPICAL_DAILY", new BigDecimal("1.25"),
                "Τυπικές καθημερινές δραστηριότητες", "Typical daily activities"),
            new ActivityLevelResponse("LIGHT", new BigDecimal("1.375"),
                "Ελαφριά δραστηριότητα", "Lightly active"),
            new ActivityLevelResponse("MODERATE", new BigDecimal("1.55"),
                "Μέτρια δραστηριότητα", "Moderately active"),
            new ActivityLevelResponse("VERY_ACTIVE", new BigDecimal("1.725"),
                "Έντονη δραστηριότητα", "Very active"),
            new ActivityLevelResponse("EXTRA_ACTIVE", new BigDecimal("1.9"),
                "Πολύ έντονη δραστηριότητα", "Extra active")
        );
    }

    /**
     * Daily energy adjustment implied by the weight goal.
     *
     * <p>Negative for loss, following the sign of {@code targetWeightChangeKg}.
     */
    private BigDecimal weightGoalAdjustment(EnergyRequirementRequest request) {
        if (request.targetWeightChangeKg() == null
            || request.targetWeightChangeKg().compareTo(BigDecimal.ZERO) == 0) {
            return BigDecimal.ZERO;
        }

        int periodDays = request.periodDays() == null ? DEFAULT_PERIOD_DAYS : request.periodDays();

        return Nutrients.divide(
            request.targetWeightChangeKg().multiply(Nutrients.KCAL_PER_KG_BODY_MASS),
            BigDecimal.valueOf(periodDays));
    }

    private void validateExactlyOneBasis(EnergyRequirementRequest request) {
        int supplied = 0;
        if (request.bmr() != null) {
            supplied++;
        }
        if (request.manualBmrKcal() != null) {
            supplied++;
        }
        if (request.manualEnergyKcal() != null) {
            supplied++;
        }

        if (supplied == 0) {
            throw new BusinessException(
                "Supply one of: anthropometrics for an equation, a basal rate, or an energy target");
        }
        if (supplied > 1) {
            throw new BusinessException(
                "Supply only one of: anthropometrics for an equation, a basal rate, or an energy target");
        }
    }

    private BigDecimal share(BigDecimal total, BigDecimal percent) {
        return Nutrients.divide(total.multiply(percent), HUNDRED);
    }
}
