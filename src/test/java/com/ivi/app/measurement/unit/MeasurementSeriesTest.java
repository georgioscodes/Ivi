package com.ivi.app.measurement.unit;

import com.ivi.app.audit.service.AuditService;
import com.ivi.app.client.dto.ClientResponse;
import com.ivi.app.client.service.ClientService;
import com.ivi.app.measurement.dto.MeasurementSeriesResponse;
import com.ivi.app.measurement.dto.MeasurementSummaryResponse;
import com.ivi.app.measurement.model.MeasurementCategory;
import com.ivi.app.measurement.model.MeasurementEntity;
import com.ivi.app.measurement.model.MeasurementTypeEntity;
import com.ivi.app.measurement.repository.MeasurementRepository;
import com.ivi.app.measurement.repository.MeasurementTypeRepository;
import com.ivi.app.measurement.service.MeasurementService;
import com.ivi.app.shared.security.AuthenticatedPractitioner;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MeasurementSeriesTest {

    private static final Long PRACTITIONER_ID = 3L;
    private static final Long CLIENT_ID = 9L;

    @Mock
    private MeasurementRepository measurementRepository;

    @Mock
    private MeasurementTypeRepository typeRepository;

    @Mock
    private ClientService clientService;

    @Mock
    private AuditService auditService;

    private MeasurementService measurementService;
    private MeasurementTypeEntity weight;
    private MeasurementTypeEntity height;

    @BeforeEach
    void setUp() {
        measurementService = new MeasurementService(
            measurementRepository, typeRepository, clientService, auditService);

        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(
                new AuthenticatedPractitioner(PRACTITIONER_ID, "m@example.gr", null, true),
                null, List.of()));

        weight = type("WEIGHT", "Βάρος", "kg", 10);
        height = type("HEIGHT", "Ύψος", "cm", 20);

        given(clientService.findById(CLIENT_ID)).willReturn(Optional.of(
            new ClientResponse(CLIENT_ID, "Μαρία", null, null, null, null, null, null, null)));
        given(typeRepository.findByCode("WEIGHT")).willReturn(Optional.of(weight));
        given(typeRepository.findByCode("HEIGHT")).willReturn(Optional.of(height));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void shouldComputeChangeFromPreviousAndFromFirst_whenBuildingASeries() {
        // Given — four visits, weight coming down
        given(measurementRepository.findAllByPractitionerIdAndClientIdAndTypeCodeOrderByRecordedOnAsc(
            PRACTITIONER_ID, CLIENT_ID, "WEIGHT")).willReturn(List.of(
                reading(weight, "82.4", "2026-05-01"),
                reading(weight, "80.1", "2026-06-01"),
                reading(weight, "78.6", "2026-07-01"),
                reading(weight, "77.2", "2026-08-01")));

        // When
        MeasurementSeriesResponse series = measurementService.series(CLIENT_ID, "WEIGHT");

        // Then
        assertThat(series.points()).hasSize(4);
        assertThat(series.points().get(0).changeFromPrevious()).isNull();
        assertThat(series.points().get(0).changeFromFirst()).isNull();
        assertThat(series.points().get(1).changeFromPrevious()).isEqualByComparingTo("-2.3");
        assertThat(series.points().get(3).changeFromPrevious()).isEqualByComparingTo("-1.4");
        assertThat(series.points().get(3).changeFromFirst()).isEqualByComparingTo("-5.2");
        assertThat(series.totalChange()).isEqualByComparingTo("-5.2");
    }

    @Test
    void shouldReturnAnEmptySeries_whenNothingHasBeenRecorded() {
        // Given
        given(measurementRepository.findAllByPractitionerIdAndClientIdAndTypeCodeOrderByRecordedOnAsc(
            PRACTITIONER_ID, CLIENT_ID, "WEIGHT")).willReturn(List.of());

        // When
        MeasurementSeriesResponse series = measurementService.series(CLIENT_ID, "WEIGHT");

        // Then — an empty chart, not an error
        assertThat(series.points()).isEmpty();
        assertThat(series.firstValue()).isNull();
        assertThat(series.totalChange()).isNull();
    }

    @Test
    void shouldDeriveBmiFromTheLatestWeightAndHeight() {
        // Given — 77.9 kg at 1.68 m
        given(measurementRepository.findAllByPractitionerIdAndClientId(PRACTITIONER_ID, CLIENT_ID))
            .willReturn(List.of(
                reading(weight, "82.4", "2026-05-01"),
                reading(weight, "77.9", "2026-08-01"),
                reading(height, "168", "2026-08-01")));

        // When
        MeasurementSummaryResponse summary = measurementService.summary(CLIENT_ID);

        // Then — 77.9 / 1.68^2
        assertThat(summary.bmi()).isEqualByComparingTo("27.6");
        assertThat(summary.bmiCategory()).isEqualTo("OVERWEIGHT");
    }

    @Test
    void shouldKeepOnlyTheLatestReadingPerType_whenSummarising() {
        // Given
        given(measurementRepository.findAllByPractitionerIdAndClientId(PRACTITIONER_ID, CLIENT_ID))
            .willReturn(List.of(
                reading(weight, "82.4", "2026-05-01"),
                reading(weight, "77.9", "2026-08-01"),
                reading(height, "168", "2026-08-01")));

        // When
        MeasurementSummaryResponse summary = measurementService.summary(CLIENT_ID);

        // Then — one row per type, showing the most recent value
        assertThat(summary.latest()).hasSize(2);
        assertThat(summary.latest().get(0).typeCode()).isEqualTo("WEIGHT");
        assertThat(summary.latest().get(0).value()).isEqualByComparingTo("77.9");
    }

    @Test
    void shouldNotFabricateBmi_whenHeightIsMissing() {
        // Given — weight only
        given(measurementRepository.findAllByPractitionerIdAndClientId(PRACTITIONER_ID, CLIENT_ID))
            .willReturn(List.of(reading(weight, "90", "2026-08-01")));

        // When
        MeasurementSummaryResponse summary = measurementService.summary(CLIENT_ID);

        // Then — a guessed BMI would be worse than none
        assertThat(summary.bmi()).isNull();
        assertThat(summary.bmiCategory()).isNull();
    }

    @Test
    void shouldReportOutOfRange_onlyWhenTheTypeDefinesOne() {
        // Given — weight has no healthy range; a marker with one does
        MeasurementTypeEntity marker = type("GLUCOSE", "Γλυκόζη", "mg/dL", 200);
        ReflectionTestUtils.setField(marker, "referenceMin", new BigDecimal("70"));
        ReflectionTestUtils.setField(marker, "referenceMax", new BigDecimal("99"));

        // When / Then
        assertThat(weight.isOutOfRange(new BigDecimal("140"))).isEmpty();
        assertThat(marker.isOutOfRange(new BigDecimal("85"))).contains(false);
        assertThat(marker.isOutOfRange(new BigDecimal("110"))).contains(true);
        assertThat(marker.isOutOfRange(new BigDecimal("60"))).contains(true);
    }

    /**
     * Measurement types are created by migration, not by the application, so the entity has no
     * public constructor. Building one reflectively here is preferable to widening production
     * visibility purely to satisfy a test.
     */
    private MeasurementTypeEntity type(String code, String label, String unit, int sortOrder) {
        MeasurementTypeEntity type;
        try {
            var constructor = MeasurementTypeEntity.class.getDeclaredConstructor();
            constructor.setAccessible(true);
            type = constructor.newInstance();
        } catch (ReflectiveOperationException ex) {
            throw new IllegalStateException("Could not construct MeasurementTypeEntity", ex);
        }
        ReflectionTestUtils.setField(type, "code", code);
        ReflectionTestUtils.setField(type, "labelEl", label);
        ReflectionTestUtils.setField(type, "labelEn", code);
        ReflectionTestUtils.setField(type, "unit", unit);
        ReflectionTestUtils.setField(type, "category", MeasurementCategory.ANTHROPOMETRIC);
        ReflectionTestUtils.setField(type, "decimals", 1);
        ReflectionTestUtils.setField(type, "sortOrder", sortOrder);
        return type;
    }

    private MeasurementEntity reading(MeasurementTypeEntity type, String value, String date) {
        return new MeasurementEntity(PRACTITIONER_ID, CLIENT_ID, type,
            new BigDecimal(value), LocalDate.parse(date), null);
    }
}
