package com.ivi.app.nutrition.unit;

import com.ivi.app.nutrition.dto.BmrEquation;
import com.ivi.app.nutrition.dto.BmrRequest;
import com.ivi.app.nutrition.dto.CoefficientRequirementRequest;
import com.ivi.app.nutrition.dto.EnergyRequirementRequest;
import com.ivi.app.nutrition.dto.EnergyRequirementResponse;
import com.ivi.app.nutrition.dto.MacroDistributionRequest;
import com.ivi.app.nutrition.dto.MacroDistributionResponse;
import com.ivi.app.nutrition.dto.Sex;
import com.ivi.app.nutrition.service.NutritionService;
import com.ivi.app.shared.exception.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * These are pure functions against published equations, so they are checked against values
 * worked out by hand rather than against the implementation's own output.
 */
class NutritionServiceTest {

    private NutritionService nutritionService;

    @BeforeEach
    void setUp() {
        nutritionService = new NutritionService();
    }

    // ---------------------------------------------------------------- BMR

    @ParameterizedTest(name = "{0} {1} {2}kg {3}cm {4}y -> {5} kcal")
    @CsvSource({
        // Worked by hand from each published equation.
        "MIFFLIN_ST_JEOR,           MALE,   80, 180, 40, 1730",
        "MIFFLIN_ST_JEOR,           FEMALE, 65, 165, 35, 1345",
        "HARRIS_BENEDICT_ORIGINAL,  MALE,   80, 180, 40, 1797",
        "HARRIS_BENEDICT_ORIGINAL,  FEMALE, 65, 165, 35, 1418",
        "HARRIS_BENEDICT_REVISED,   MALE,   80, 180, 40, 1797",
        "HARRIS_BENEDICT_REVISED,   FEMALE, 65, 165, 35, 1408"
    })
    void shouldMatchTheHandWorkedValue_whenApplyingAPublishedEquation(
            BmrEquation equation, Sex sex, String weight, String height, int age, String expected) {

        // Given
        BmrRequest request = new BmrRequest(equation, sex,
            new BigDecimal(weight), new BigDecimal(height), age);

        // When / Then
        assertThat(nutritionService.calculateBmr(request).bmrKcal())
            .isEqualByComparingTo(expected);
    }

    @Test
    void shouldReportTheEquationUsed_whenCalculatingBmr() {
        // Given
        BmrRequest request = new BmrRequest(BmrEquation.MIFFLIN_ST_JEOR, Sex.MALE,
            new BigDecimal("80"), new BigDecimal("180"), 40);

        // When / Then
        assertThat(nutritionService.calculateBmr(request).equation()).isEqualTo("MIFFLIN_ST_JEOR");
    }

    // ------------------------------------------------- Energy requirement

    @Test
    void shouldSubtractADailyDeficit_whenTheGoalIsToLoseWeight() {
        // Given — 1860 basal, activity 1.25, losing 1.5 kg over 30 days.
        // Maintenance is 1860 x 1.25 = 2325. The deficit is (1.5 x 7700) / 30 = 385.
        EnergyRequirementRequest request = new EnergyRequirementRequest(
            null, new BigDecimal("1860"), null,
            new BigDecimal("1.25"), new BigDecimal("-1.5"), 30);

        // When
        EnergyRequirementResponse response = nutritionService.calculateEnergyRequirement(request);

        // Then
        assertThat(response.maintenanceKcal()).isEqualByComparingTo("2325");
        assertThat(response.weightGoalAdjustmentKcal()).isEqualByComparingTo("-385");
        assertThat(response.targetKcal()).isEqualByComparingTo("1940");
        assertThat(response.basis()).isEqualTo("MANUAL");
    }

    @Test
    void shouldAddADailySurplus_whenTheGoalIsToGainWeight() {
        // Given
        EnergyRequirementRequest request = new EnergyRequirementRequest(
            null, new BigDecimal("1860"), null,
            new BigDecimal("1.25"), new BigDecimal("1.5"), 30);

        // When
        EnergyRequirementResponse response = nutritionService.calculateEnergyRequirement(request);

        // Then — the sign convention holds in both directions
        assertThat(response.weightGoalAdjustmentKcal()).isEqualByComparingTo("385");
        assertThat(response.targetKcal()).isEqualByComparingTo("2710");
    }

    @Test
    void shouldReturnMaintenance_whenNoWeightChangeIsRequested() {
        // Given
        EnergyRequirementRequest request = new EnergyRequirementRequest(
            null, new BigDecimal("1860"), null, new BigDecimal("1.25"), null, null);

        // When
        EnergyRequirementResponse response = nutritionService.calculateEnergyRequirement(request);

        // Then
        assertThat(response.weightGoalAdjustmentKcal()).isEqualByComparingTo("0");
        assertThat(response.targetKcal()).isEqualByComparingTo("2325");
    }

    @Test
    void shouldDefaultToAThirtyDayPeriod_whenNoneIsGiven() {
        // Given
        EnergyRequirementRequest request = new EnergyRequirementRequest(
            null, new BigDecimal("1860"), null,
            new BigDecimal("1.25"), new BigDecimal("-1.5"), null);

        // When / Then
        assertThat(nutritionService.calculateEnergyRequirement(request).targetKcal())
            .isEqualByComparingTo("1940");
    }

    @Test
    void shouldSpreadTheSameChangeMoreGently_whenThePeriodIsLonger() {
        // Given — the same 1.5 kg over 60 days rather than 30
        EnergyRequirementRequest request = new EnergyRequirementRequest(
            null, new BigDecimal("1860"), null,
            new BigDecimal("1.25"), new BigDecimal("-1.5"), 60);

        // When / Then
        assertThat(nutritionService.calculateEnergyRequirement(request).weightGoalAdjustmentKcal())
            .isEqualByComparingTo("-193");
    }

    @Test
    void shouldDeriveTheBasalRateFromAnthropometrics_whenAnEquationIsSupplied() {
        // Given
        BmrRequest bmr = new BmrRequest(BmrEquation.MIFFLIN_ST_JEOR, Sex.MALE,
            new BigDecimal("80"), new BigDecimal("180"), 40);
        EnergyRequirementRequest request = new EnergyRequirementRequest(
            bmr, null, null, new BigDecimal("1.5"), null, null);

        // When
        EnergyRequirementResponse response = nutritionService.calculateEnergyRequirement(request);

        // Then — 1730 x 1.5
        assertThat(response.bmrKcal()).isEqualByComparingTo("1730");
        assertThat(response.targetKcal()).isEqualByComparingTo("2595");
        assertThat(response.basis()).isEqualTo("MIFFLIN_ST_JEOR");
    }

    @Test
    void shouldIgnoreActivityAndWeightGoal_whenTheTargetIsStatedDirectly() {
        // Given — "a 2000 kcal plan", with an activity factor that must not be applied
        EnergyRequirementRequest request = new EnergyRequirementRequest(
            null, null, new BigDecimal("2000"),
            new BigDecimal("1.9"), new BigDecimal("-2"), 30);

        // When
        EnergyRequirementResponse response = nutritionService.calculateEnergyRequirement(request);

        // Then
        assertThat(response.targetKcal()).isEqualByComparingTo("2000");
        assertThat(response.basis()).isEqualTo("DIRECT");
        assertThat(response.bmrKcal()).isNull();
    }

    @Test
    void shouldReject_whenNoBasisIsSupplied() {
        // Given
        EnergyRequirementRequest request = new EnergyRequirementRequest(
            null, null, null, new BigDecimal("1.25"), null, null);

        // When / Then
        assertThatThrownBy(() -> nutritionService.calculateEnergyRequirement(request))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("Supply one of");
    }

    @Test
    void shouldReject_whenMoreThanOneBasisIsSupplied() {
        // Given — ambiguous: which should win?
        BmrRequest bmr = new BmrRequest(BmrEquation.MIFFLIN_ST_JEOR, Sex.MALE,
            new BigDecimal("80"), new BigDecimal("180"), 40);
        EnergyRequirementRequest request = new EnergyRequirementRequest(
            bmr, new BigDecimal("1800"), null, new BigDecimal("1.25"), null, null);

        // When / Then
        assertThatThrownBy(() -> nutritionService.calculateEnergyRequirement(request))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("only one");
    }

    @Test
    void shouldReject_whenAnActivityFactorIsMissingForADerivedTarget() {
        // Given
        EnergyRequirementRequest request = new EnergyRequirementRequest(
            null, new BigDecimal("1800"), null, null, null, null);

        // When / Then
        assertThatThrownBy(() -> nutritionService.calculateEnergyRequirement(request))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("activity factor is required");
    }

    @Test
    void shouldReject_whenTheWeightGoalDrivesTheTargetToZero() {
        // Given — 10 kg in a single day is arithmetically possible and clinically absurd
        EnergyRequirementRequest request = new EnergyRequirementRequest(
            null, new BigDecimal("1800"), null,
            new BigDecimal("1.2"), new BigDecimal("-10"), 1);

        // When / Then
        assertThatThrownBy(() -> nutritionService.calculateEnergyRequirement(request))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("non-positive");
    }

    // -------------------------------------------------- Macro distribution

    @Test
    void shouldSplitEnergyIntoMacronutrientMasses_whenGivenPercentages() {
        // Given — 2000 kcal at 45/25/30
        MacroDistributionRequest request = new MacroDistributionRequest(
            new BigDecimal("2000"), new BigDecimal("45"), new BigDecimal("25"), new BigDecimal("30"));

        // When
        MacroDistributionResponse response = nutritionService.distributeMacros(request);

        // Then — 900 kcal / 4, 500 / 4, 600 / 9
        assertThat(response.carbohydrateG()).isEqualByComparingTo("225.0");
        assertThat(response.proteinG()).isEqualByComparingTo("125.0");
        assertThat(response.fatG()).isEqualByComparingTo("66.7");
        assertThat(response.carbohydrateKcal()).isEqualByComparingTo("900");
        assertThat(response.proteinKcal()).isEqualByComparingTo("500");
        assertThat(response.fatKcal()).isEqualByComparingTo("600");
    }

    @Test
    void shouldAcceptSliderRounding_whenPercentagesMissOneHundredSlightly() {
        // Given — 33.3 + 33.3 + 33.4 is what a UI with sliders actually sends
        MacroDistributionRequest request = new MacroDistributionRequest(
            new BigDecimal("2000"), new BigDecimal("33.3"),
            new BigDecimal("33.3"), new BigDecimal("33.4"));

        // When / Then
        assertThat(nutritionService.distributeMacros(request)).isNotNull();
    }

    @Test
    void shouldReject_whenPercentagesDoNotTotalOneHundred() {
        // Given
        MacroDistributionRequest request = new MacroDistributionRequest(
            new BigDecimal("2000"), new BigDecimal("50"), new BigDecimal("30"), new BigDecimal("30"));

        // When / Then
        assertThatThrownBy(() -> nutritionService.distributeMacros(request))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("must total 100");
    }

    // ------------------------------------------------------- Coefficients

    @Test
    void shouldDeriveEnergyFromPerKilogramCoefficients() {
        // Given — 80 kg at 4 g/kg carbohydrate, 1.8 g/kg protein, 1 g/kg fat
        CoefficientRequirementRequest request = new CoefficientRequirementRequest(
            new BigDecimal("80"), new BigDecimal("4"), new BigDecimal("1.8"), new BigDecimal("1"));

        // When
        MacroDistributionResponse response = nutritionService.calculateFromCoefficients(request);

        // Then — 320 g carb (1280), 144 g protein (576), 80 g fat (720)
        assertThat(response.carbohydrateG()).isEqualByComparingTo("320.0");
        assertThat(response.proteinG()).isEqualByComparingTo("144.0");
        assertThat(response.fatG()).isEqualByComparingTo("80.0");
        assertThat(response.targetKcal()).isEqualByComparingTo("2576");
    }

    @Test
    void shouldReject_whenAllCoefficientsAreZero() {
        // Given
        CoefficientRequirementRequest request = new CoefficientRequirementRequest(
            new BigDecimal("80"), BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO);

        // When / Then
        assertThatThrownBy(() -> nutritionService.calculateFromCoefficients(request))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("no energy");
    }

    // ----------------------------------------------------- Activity levels

    @Test
    void shouldOfferActivityPresetsIncludingTheCommonIntermediateValue() {
        // When / Then
        assertThat(nutritionService.activityLevels())
            .extracting(level -> level.factor().toPlainString())
            .contains("1.2", "1.25", "1.375", "1.55", "1.725", "1.9");
    }
}
