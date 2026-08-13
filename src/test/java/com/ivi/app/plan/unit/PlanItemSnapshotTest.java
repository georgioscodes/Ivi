package com.ivi.app.plan.unit;

import com.ivi.app.plan.model.MealType;
import com.ivi.app.plan.model.PlanDayEntity;
import com.ivi.app.plan.model.PlanEntity;
import com.ivi.app.plan.model.PlanItemEntity;
import com.ivi.app.plan.model.PlanMealEntity;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The arithmetic a practitioner watches change as they build a plan, and the snapshot rule that
 * keeps an issued plan meaning what it meant when it was issued.
 */
class PlanItemSnapshotTest {

    @Test
    void shouldScaleNutrientsByPortionWeightAndQuantity_whenAnItemIsCreated() {
        // Given — an egg at 155 kcal/100g, portion 55 g, two of them
        PlanItemEntity item = egg(new BigDecimal("2"));

        // Then — 110 g, so 1.1 x the per-100g figures
        assertThat(item.getTotalGrams()).isEqualByComparingTo("110");
        assertThat(item.getEnergyKcal()).isEqualByComparingTo("170.5");
        assertThat(item.getProteinG()).isEqualByComparingTo("14.3");
        assertThat(item.getFatG()).isEqualByComparingTo("12.1");
    }

    @Test
    void shouldRescaleProportionally_whenTheQuantityChanges() {
        // Given
        PlanItemEntity item = egg(new BigDecimal("2"));

        // When
        item.changeQuantity(new BigDecimal("3"));

        // Then — 165 g at 155 kcal/100g
        assertThat(item.getTotalGrams()).isEqualByComparingTo("165");
        assertThat(item.getEnergyKcal()).isEqualByComparingTo("255.75");
    }

    @Test
    void shouldReturnToTheOriginalFigures_whenQuantityIsChangedAndChangedBack() {
        // Given
        PlanItemEntity item = egg(new BigDecimal("2"));
        BigDecimal original = item.getEnergyKcal();

        // When — the rescale is multiplicative, so drift would accumulate here
        item.changeQuantity(new BigDecimal("7"));
        item.changeQuantity(new BigDecimal("3"));
        item.changeQuantity(new BigDecimal("2"));

        // Then
        assertThat(item.getEnergyKcal()).isEqualByComparingTo(original);
    }

    @Test
    void shouldPreferTheOverride_whenAPrintedNameIsSet() {
        // Given
        PlanItemEntity item = egg(BigDecimal.ONE);
        assertThat(item.getDisplayName()).isEqualTo("Αυγό");

        // When
        item.setNameOverride("Αυγά βραστά");

        // Then
        assertThat(item.getDisplayName()).isEqualTo("Αυγά βραστά");
    }

    @Test
    void shouldFallBackToTheFoodName_whenTheOverrideIsBlank() {
        // Given
        PlanItemEntity item = egg(BigDecimal.ONE);

        // When
        item.setNameOverride("   ");

        // Then
        assertThat(item.getDisplayName()).isEqualTo("Αυγό");
    }

    @Test
    void shouldTotalAcrossMealsAndDays() {
        // Given
        PlanEntity plan = new PlanEntity(1L, 1L, "Test",
            new BigDecimal("2000"), new BigDecimal("125"),
            new BigDecimal("225"), new BigDecimal("67"));

        PlanDayEntity day = new PlanDayEntity(0);
        PlanMealEntity breakfast = new PlanMealEntity(MealType.BREAKFAST, 0);
        PlanMealEntity lunch = new PlanMealEntity(MealType.LUNCH, 1);
        day.addMeal(breakfast);
        day.addMeal(lunch);
        plan.addDay(day);

        // When — 170.5 kcal in one meal, the same again in the other
        breakfast.addItem(egg(new BigDecimal("2")));
        lunch.addItem(egg(new BigDecimal("2")));

        // Then
        assertThat(breakfast.totalEnergyKcal()).isEqualByComparingTo("170.5");
        assertThat(day.totalEnergyKcal()).isEqualByComparingTo("341");
        assertThat(plan.totalEnergyKcal()).isEqualByComparingTo("341");
    }

    @Test
    void shouldAverageOverTheNumberOfDays() {
        // Given — 341 kcal of food, spread across a two-day plan
        PlanEntity plan = new PlanEntity(1L, 1L, "Test",
            new BigDecimal("2000"), new BigDecimal("125"),
            new BigDecimal("225"), new BigDecimal("67"));

        PlanDayEntity monday = new PlanDayEntity(0);
        PlanMealEntity breakfast = new PlanMealEntity(MealType.BREAKFAST, 0);
        monday.addMeal(breakfast);
        breakfast.addItem(egg(new BigDecimal("4")));
        plan.addDay(monday);
        plan.addDay(new PlanDayEntity(1));

        // When / Then — 341 over two days
        assertThat(plan.averageDailyEnergyKcal()).isEqualByComparingTo("170.5");
    }

    /** 155 kcal, 13 g protein, 1.1 g carbohydrate, 11 g fat per 100 g; portion 55 g. */
    private PlanItemEntity egg(BigDecimal quantity) {
        return new PlanItemEntity(
            21L, "Αυγό", "τεμάχιο", new BigDecimal("55"), quantity,
            new BigDecimal("155"), new BigDecimal("13"),
            new BigDecimal("1.1"), new BigDecimal("11"), 0);
    }
}
