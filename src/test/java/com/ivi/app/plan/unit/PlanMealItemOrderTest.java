package com.ivi.app.plan.unit;

import com.ivi.app.plan.dto.PlanMealResponse;
import com.ivi.app.plan.mapper.PlanMapper;
import com.ivi.app.plan.model.MealType;
import com.ivi.app.plan.model.PlanItemEntity;
import com.ivi.app.plan.model.PlanMealEntity;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * A meal's items come back in {@code sortOrder}, whatever order the in-memory collection happens
 * to be in.
 *
 * <p>This was a real defect, found by dragging a row in the browser and watching it snap back.
 * {@code @OrderBy} on the collection applies when Hibernate <em>loads</em> it; reordering mutates
 * {@code sortOrder} on entities already in the persistence context, so the list kept its original
 * sequence and the response carried the new sort values attached to items still listed in the old
 * order. A subsequent read returned them correctly, and the two disagreed.
 *
 * <p>The client replaces its whole state from a mutation response precisely so screen and server
 * cannot drift apart, which makes a response that contradicts the next read a failure at the
 * foundation rather than a cosmetic one.
 */
class PlanMealItemOrderTest {

    @Test
    void shouldReturnItemsInSortOrder_whenTheCollectionIsOutOfSequence() {
        // Given — the state a reorder leaves behind: sort values updated in place, list untouched
        PlanMealEntity meal = new PlanMealEntity(MealType.BREAKFAST, 0);
        PlanItemEntity first = item("Αγγούρι", 0);
        PlanItemEntity second = item("Αμύγδαλα", 1);
        PlanItemEntity third = item("Αυγό", 2);
        meal.addItem(first);
        meal.addItem(second);
        meal.addItem(third);

        // When — the practitioner reverses the meal
        first.setSortOrder(2);
        third.setSortOrder(0);

        PlanMealResponse response = PlanMapper.toDto(meal);

        // Then — the response reflects the move, rather than the order the list happens to hold
        assertThat(response.items())
            .extracting(dto -> dto.name())
            .containsExactly("Αυγό", "Αμύγδαλα", "Αγγούρι");
    }

    @Test
    void shouldKeepItemsInOrder_whenNothingHasBeenReordered() {
        // Given — the ordinary case must not be disturbed by the fix
        PlanMealEntity meal = new PlanMealEntity(MealType.BREAKFAST, 0);
        meal.addItem(item("Αγγούρι", 0));
        meal.addItem(item("Αμύγδαλα", 1));
        meal.addItem(item("Αυγό", 2));

        // When / Then
        assertThat(PlanMapper.toDto(meal).items())
            .extracting(dto -> dto.name())
            .containsExactly("Αγγούρι", "Αμύγδαλα", "Αυγό");
    }

    @Test
    void shouldCarryTheSortOrderThatWasStored() {
        // Given
        PlanMealEntity meal = new PlanMealEntity(MealType.BREAKFAST, 0);
        PlanItemEntity only = item("Αυγό", 0);
        meal.addItem(only);

        // When
        only.setSortOrder(3);

        // Then — the client uses this to build the id list a reorder request needs
        assertThat(PlanMapper.toDto(meal).items().get(0).sortOrder()).isEqualTo(3);
    }

    /** 155 kcal, 13 g protein, 1.1 g carbohydrate, 11 g fat per 100 g; portion 55 g. */
    private PlanItemEntity item(String name, int sortOrder) {
        return new PlanItemEntity(
            21L, name, "τεμάχιο", new BigDecimal("55"), BigDecimal.ONE,
            new BigDecimal("155"), new BigDecimal("13"),
            new BigDecimal("1.1"), new BigDecimal("11"), sortOrder);
    }
}
