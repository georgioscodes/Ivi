package com.ivi.app.plan.mapper;

import com.ivi.app.plan.dto.MacroTotals;
import com.ivi.app.plan.dto.PlanDayResponse;
import com.ivi.app.plan.dto.PlanItemResponse;
import com.ivi.app.plan.dto.PlanMealResponse;
import com.ivi.app.plan.dto.PlanResponse;
import com.ivi.app.plan.dto.PlanSummaryResponse;
import com.ivi.app.plan.model.PlanDayEntity;
import com.ivi.app.plan.model.PlanEntity;
import com.ivi.app.plan.model.PlanItemEntity;
import com.ivi.app.plan.model.PlanMealEntity;
import com.ivi.app.shared.util.Nutrients;

import java.math.BigDecimal;
import java.util.List;

public final class PlanMapper {

    private static final BigDecimal HUNDRED = new BigDecimal("100");

    private PlanMapper() {
        // Utility class — no instantiation
    }

    public static PlanResponse toDto(PlanEntity plan) {
        return new PlanResponse(
            plan.getId(),
            plan.getClientId(),
            plan.getName(),
            plan.getStatus().name(),
            new MacroTotals(
                Nutrients.roundEnergy(plan.getTargetKcal()),
                Nutrients.roundMacro(plan.getTargetProteinG()),
                Nutrients.roundMacro(plan.getTargetCarbohydrateG()),
                Nutrients.roundMacro(plan.getTargetFatG())
            ),
            plan.getBasis(),
            plan.getActivityFactor(),
            plan.getNotes(),
            plan.getDays().stream().map(day -> toDto(day, plan)).toList(),
            dailyAverage(plan),
            plan.getVersion(),
            plan.getCreatedAt(),
            plan.getUpdatedAt()
        );
    }

    public static PlanSummaryResponse toSummaryDto(PlanEntity plan) {
        return new PlanSummaryResponse(
            plan.getId(),
            plan.getClientId(),
            plan.getName(),
            plan.getStatus().name(),
            Nutrients.roundEnergy(plan.getTargetKcal()),
            plan.getDays().size(),
            plan.getCreatedAt(),
            plan.getUpdatedAt()
        );
    }

    public static PlanDayResponse toDto(PlanDayEntity day, PlanEntity plan) {
        return new PlanDayResponse(
            day.getId(),
            day.getDayIndex(),
            day.getLabelOverride(),
            day.getMeals().stream().map(PlanMapper::toDto).toList(),
            new MacroTotals(
                Nutrients.roundEnergy(day.totalEnergyKcal()),
                Nutrients.roundMacro(day.totalProteinG()),
                Nutrients.roundMacro(day.totalCarbohydrateG()),
                Nutrients.roundMacro(day.totalFatG())
            ),
            percentOfTarget(day, plan)
        );
    }

    public static PlanMealResponse toDto(PlanMealEntity meal) {
        return new PlanMealResponse(
            meal.getId(),
            meal.getMealType().name(),
            meal.getTimeLabel(),
            meal.getSortOrder(),
            meal.getItems().stream().map(PlanMapper::toDto).toList(),
            new MacroTotals(
                Nutrients.roundEnergy(meal.totalEnergyKcal()),
                Nutrients.roundMacro(meal.totalProteinG()),
                Nutrients.roundMacro(meal.totalCarbohydrateG()),
                Nutrients.roundMacro(meal.totalFatG())
            )
        );
    }

    public static PlanItemResponse toDto(PlanItemEntity item) {
        return new PlanItemResponse(
            item.getId(),
            item.getFoodId(),
            item.getDisplayName(),
            item.getPortionLabel(),
            Nutrients.roundMacro(item.getPortionGrams()),
            item.getQuantity().stripTrailingZeros(),
            Nutrients.roundMacro(item.getTotalGrams()),
            Nutrients.roundEnergy(item.getEnergyKcal()),
            Nutrients.roundMacro(item.getProteinG()),
            Nutrients.roundMacro(item.getCarbohydrateG()),
            Nutrients.roundMacro(item.getFatG()),
            item.getSortOrder()
        );
    }

    public static List<PlanSummaryResponse> toSummaryDtoList(List<PlanEntity> plans) {
        return plans.stream().map(PlanMapper::toSummaryDto).toList();
    }

    /**
     * Progress against target, per macro, for the day's progress bars.
     *
     * <p>Computed from unrounded totals so the percentage matches the numbers beside it. Rounding
     * first and dividing after is how a bar reads 99% next to a figure that has clearly hit target.
     */
    private static MacroTotals percentOfTarget(PlanDayEntity day, PlanEntity plan) {
        return new MacroTotals(
            percent(day.totalEnergyKcal(), plan.getTargetKcal()),
            percent(day.totalProteinG(), plan.getTargetProteinG()),
            percent(day.totalCarbohydrateG(), plan.getTargetCarbohydrateG()),
            percent(day.totalFatG(), plan.getTargetFatG())
        );
    }

    private static BigDecimal percent(BigDecimal actual, BigDecimal target) {
        if (target == null || target.compareTo(BigDecimal.ZERO) == 0) {
            return BigDecimal.ZERO.setScale(1);
        }
        return Nutrients.roundPercent(Nutrients.divide(actual.multiply(HUNDRED), target));
    }

    private static MacroTotals dailyAverage(PlanEntity plan) {
        int dayCount = plan.getDays().size();
        if (dayCount == 0) {
            return new MacroTotals(BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO);
        }

        BigDecimal days = BigDecimal.valueOf(dayCount);
        BigDecimal energy = BigDecimal.ZERO;
        BigDecimal protein = BigDecimal.ZERO;
        BigDecimal carbohydrate = BigDecimal.ZERO;
        BigDecimal fat = BigDecimal.ZERO;

        for (PlanDayEntity day : plan.getDays()) {
            energy = energy.add(day.totalEnergyKcal());
            protein = protein.add(day.totalProteinG());
            carbohydrate = carbohydrate.add(day.totalCarbohydrateG());
            fat = fat.add(day.totalFatG());
        }

        return new MacroTotals(
            Nutrients.roundEnergy(Nutrients.divide(energy, days)),
            Nutrients.roundMacro(Nutrients.divide(protein, days)),
            Nutrients.roundMacro(Nutrients.divide(carbohydrate, days)),
            Nutrients.roundMacro(Nutrients.divide(fat, days))
        );
    }
}
