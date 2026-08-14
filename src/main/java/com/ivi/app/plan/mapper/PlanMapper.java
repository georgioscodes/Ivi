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
import java.util.Comparator;
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
            dailyAveragePercent(plan),
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

    /**
     * Items are sorted here rather than relied upon to arrive sorted.
     *
     * {@code @OrderBy} on the collection applies when Hibernate <em>loads</em> it. Reordering
     * mutates {@code sortOrder} on entities already in the persistence context, and the in-memory
     * list keeps its original sequence — so the response to a reorder carried the new sort values
     * attached to items still listed in the old order, while a subsequent read returned them
     * correctly. The two disagreed.
     *
     * <p>That matters more than it looks. The client treats a mutation response as the canonical
     * plan and replaces its state with it, precisely so screen and server cannot drift apart. A
     * response that contradicts the next read breaks that guarantee at its foundation: the
     * practitioner dragged a row, the server stored the move, and the screen snapped back.
     *
     * <p>Sorting in the mapper rather than in {@code reorderItems} covers every response the same
     * way, whichever operation produced it.
     */
    public static PlanMealResponse toDto(PlanMealEntity meal) {
        List<PlanItemResponse> items = meal.getItems().stream()
            .sorted(Comparator.comparingInt(PlanItemEntity::getSortOrder)
                .thenComparing(PlanItemEntity::getId))
            .map(PlanMapper::toDto)
            .toList();

        return new PlanMealResponse(
            meal.getId(),
            meal.getMealType().name(),
            meal.getTimeLabel(),
            meal.getSortOrder(),
            items,
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
        MacroTotals mean = meanPerDay(plan);
        return new MacroTotals(
            Nutrients.roundEnergy(mean.energyKcal()),
            Nutrients.roundMacro(mean.proteinG()),
            Nutrients.roundMacro(mean.carbohydrateG()),
            Nutrients.roundMacro(mean.fatG())
        );
    }

    /**
     * The average day against target.
     *
     * <p>Taken from the unrounded mean for the same reason {@link #percentOfTarget} is taken from
     * unrounded totals: rounding before dividing is how a figure that has plainly hit target ends
     * up beside a percentage that says 99.
     */
    private static MacroTotals dailyAveragePercent(PlanEntity plan) {
        MacroTotals mean = meanPerDay(plan);
        return new MacroTotals(
            percent(mean.energyKcal(), plan.getTargetKcal()),
            percent(mean.proteinG(), plan.getTargetProteinG()),
            percent(mean.carbohydrateG(), plan.getTargetCarbohydrateG()),
            percent(mean.fatG(), plan.getTargetFatG())
        );
    }

    /** Unrounded, so callers can round or divide as each needs. */
    private static MacroTotals meanPerDay(PlanEntity plan) {
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
            Nutrients.divide(energy, days),
            Nutrients.divide(protein, days),
            Nutrients.divide(carbohydrate, days),
            Nutrients.divide(fat, days)
        );
    }
}
