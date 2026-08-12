package com.ivi.app.food.unit;

import com.ivi.app.food.dto.FoodResponse;
import com.ivi.app.food.dto.FoodUpdateRequest;
import com.ivi.app.food.model.FoodCategory;
import com.ivi.app.food.model.FoodEntity;
import com.ivi.app.food.repository.FoodRepository;
import com.ivi.app.food.repository.FoodSuggestionRepository;
import com.ivi.app.food.service.FoodService;
import com.ivi.app.shared.security.AuthenticatedPractitioner;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.mockito.Mockito.never;

/**
 * The branch that decides between editing in place and copying into an override.
 *
 * <p>Getting this wrong in the "global" direction would let one practitioner's edit change what
 * every other practitioner sees, so the assertion that the catalogue row is never saved matters
 * as much as the assertion that an override is created.
 */
@ExtendWith(MockitoExtension.class)
class FoodServiceOverrideTest {

    private static final Long PRACTITIONER_ID = 7L;

    @Mock
    private FoodRepository foodRepository;

    @Mock
    private FoodSuggestionRepository suggestionRepository;

    private FoodService foodService;

    @BeforeEach
    void setUp() {
        foodService = new FoodService(foodRepository, suggestionRepository);
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(
                new AuthenticatedPractitioner(PRACTITIONER_ID, "chef@example.gr", null, true),
                null, java.util.List.of()));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void shouldCreateAnOverrideAndLeaveTheCatalogueUntouched_whenEditingAGlobalFood() {
        // Given
        FoodEntity global = globalFood(25L, "Φέτα", new BigDecimal("264"));
        given(foodRepository.findOwnedById(25L, PRACTITIONER_ID)).willReturn(Optional.empty());
        given(foodRepository.findOverride(25L, PRACTITIONER_ID)).willReturn(Optional.empty());
        given(foodRepository.findGlobalById(25L)).willReturn(Optional.of(global));
        given(foodRepository.save(any(FoodEntity.class)))
            .willAnswer(invocation -> invocation.getArgument(0));

        // When
        Optional<FoodResponse> result = foodService.update(25L, request("Φέτα ΠΟΠ", "290"));

        // Then
        ArgumentCaptor<FoodEntity> captor = ArgumentCaptor.forClass(FoodEntity.class);
        then(foodRepository).should().save(captor.capture());

        FoodEntity saved = captor.getValue();
        assertThat(saved).isNotSameAs(global);
        assertThat(saved.getOverridesFoodId()).isEqualTo(25L);
        assertThat(saved.getPractitionerId()).isEqualTo(PRACTITIONER_ID);
        assertThat(saved.getEnergyKcal()).isEqualByComparingTo("290");

        // The catalogue row keeps its own values
        assertThat(global.getNameEl()).isEqualTo("Φέτα");
        assertThat(global.getEnergyKcal()).isEqualByComparingTo("264");
        assertThat(result).isPresent();
        assertThat(result.get().overridden()).isTrue();
    }

    @Test
    void shouldCopyPortionsOntoTheOverride_whenNoneAreSupplied() {
        // Given
        FoodEntity global = globalFood(25L, "Φέτα", new BigDecimal("264"));
        global.addPortion(new com.ivi.app.food.model.FoodPortionEntity(
            "μερίδα", new BigDecimal("30"), true, 0));

        given(foodRepository.findOwnedById(25L, PRACTITIONER_ID)).willReturn(Optional.empty());
        given(foodRepository.findOverride(25L, PRACTITIONER_ID)).willReturn(Optional.empty());
        given(foodRepository.findGlobalById(25L)).willReturn(Optional.of(global));
        given(foodRepository.save(any(FoodEntity.class)))
            .willAnswer(invocation -> invocation.getArgument(0));

        // When
        foodService.update(25L, request("Φέτα ΠΟΠ", "290"));

        // Then — overriding a value must not silently cost the practitioner their units
        ArgumentCaptor<FoodEntity> captor = ArgumentCaptor.forClass(FoodEntity.class);
        then(foodRepository).should().save(captor.capture());
        assertThat(captor.getValue().getPortions())
            .extracting(com.ivi.app.food.model.FoodPortionEntity::getLabelEl)
            .containsExactly("μερίδα");
    }

    @Test
    void shouldUpdateTheExistingOverride_whenTheFoodIsAlreadyOverridden() {
        // Given
        FoodEntity existing = overrideFood(99L, 25L, "Φέτα ΠΟΠ", new BigDecimal("290"));
        given(foodRepository.findOwnedById(25L, PRACTITIONER_ID)).willReturn(Optional.empty());
        given(foodRepository.findOverride(25L, PRACTITIONER_ID)).willReturn(Optional.of(existing));
        given(foodRepository.save(any(FoodEntity.class)))
            .willAnswer(invocation -> invocation.getArgument(0));

        // When
        foodService.update(25L, request("Φέτα Ηπείρου", "280"));

        // Then — no second override is created
        then(foodRepository).should(never()).findGlobalById(any());
        assertThat(existing.getNameEl()).isEqualTo("Φέτα Ηπείρου");
        assertThat(existing.getEnergyKcal()).isEqualByComparingTo("280");
    }

    @Test
    void shouldEditInPlace_whenTheFoodIsAlreadyOwned() {
        // Given
        FoodEntity own = FoodEntity.custom(PRACTITIONER_ID, "Τραχανάς", FoodCategory.CARBOHYDRATE,
            new BigDecimal("360"), new BigDecimal("12"), new BigDecimal("68"), new BigDecimal("4"));
        ReflectionTestUtils.setField(own, "id", 36L);

        given(foodRepository.findOwnedById(36L, PRACTITIONER_ID)).willReturn(Optional.of(own));
        given(foodRepository.save(any(FoodEntity.class)))
            .willAnswer(invocation -> invocation.getArgument(0));

        // When
        foodService.update(36L, request("Τραχανάς γλυκός", "355"));

        // Then
        then(foodRepository).should(never()).findGlobalById(any());
        assertThat(own.getOverridesFoodId()).isNull();
        assertThat(own.getNameEl()).isEqualTo("Τραχανάς γλυκός");
    }

    @Test
    void shouldReturnEmpty_whenTheFoodBelongsToAnotherPractitioner() {
        // Given — not owned, not overridden, and not in the catalogue either
        given(foodRepository.findOwnedById(500L, PRACTITIONER_ID)).willReturn(Optional.empty());
        given(foodRepository.findOverride(500L, PRACTITIONER_ID)).willReturn(Optional.empty());
        given(foodRepository.findGlobalById(500L)).willReturn(Optional.empty());

        // When
        Optional<FoodResponse> result = foodService.update(500L, request("Hijacked", "1"));

        // Then — the controller turns this into a 404
        assertThat(result).isEmpty();
        then(foodRepository).should(never()).save(any());
    }

    private FoodUpdateRequest request(String name, String energy) {
        return new FoodUpdateRequest(name, null, "PROTEIN",
            new BigDecimal(energy), new BigDecimal("16"), new BigDecimal("3.5"),
            new BigDecimal("24"), null);
    }

    private FoodEntity globalFood(Long id, String name, BigDecimal energy) {
        FoodEntity food = FoodEntity.custom(null, name, FoodCategory.PROTEIN,
            energy, new BigDecimal("14"), new BigDecimal("4.1"), new BigDecimal("21"));
        ReflectionTestUtils.setField(food, "id", id);
        return food;
    }

    private FoodEntity overrideFood(Long id, Long overrides, String name, BigDecimal energy) {
        FoodEntity food = FoodEntity.custom(PRACTITIONER_ID, name, FoodCategory.PROTEIN,
            energy, new BigDecimal("14"), new BigDecimal("4.1"), new BigDecimal("21"));
        ReflectionTestUtils.setField(food, "id", id);
        ReflectionTestUtils.setField(food, "overridesFoodId", overrides);
        return food;
    }
}
