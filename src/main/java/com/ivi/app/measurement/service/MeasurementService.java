package com.ivi.app.measurement.service;

import com.ivi.app.client.service.ClientService;
import com.ivi.app.measurement.dto.MeasurementBatchRequest;
import com.ivi.app.measurement.dto.MeasurementRecordRequest;
import com.ivi.app.measurement.dto.MeasurementResponse;
import com.ivi.app.measurement.dto.MeasurementSeriesResponse;
import com.ivi.app.measurement.dto.MeasurementSummaryResponse;
import com.ivi.app.measurement.dto.MeasurementTypeResponse;
import com.ivi.app.measurement.mapper.MeasurementMapper;
import com.ivi.app.measurement.model.MeasurementEntity;
import com.ivi.app.measurement.model.MeasurementTypeEntity;
import com.ivi.app.measurement.repository.MeasurementRepository;
import com.ivi.app.measurement.repository.MeasurementTypeRepository;
import com.ivi.app.shared.dto.PagedResponse;
import com.ivi.app.shared.exception.BusinessException;
import com.ivi.app.shared.security.CurrentPractitioner;
import com.ivi.app.shared.util.Nutrients;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class MeasurementService {

    private final MeasurementRepository measurementRepository;
    private final MeasurementTypeRepository typeRepository;
    private final ClientService clientService;

    @Transactional(readOnly = true)
    public List<MeasurementTypeResponse> types() {
        return MeasurementMapper.toTypeDtoList(typeRepository.findAllByOrderBySortOrderAsc());
    }

    /**
     * Records a value, or corrects the existing one if this client already has that type on
     * that date. Recording a weight twice in a day is a correction, not a second data point.
     */
    public MeasurementResponse record(MeasurementRecordRequest request) {
        Long practitionerId = CurrentPractitioner.requireId();
        requireOwnClient(request.clientId());

        MeasurementTypeEntity type = requireType(request.typeCode());
        LocalDate recordedOn = request.recordedOn() == null ? LocalDate.now() : request.recordedOn();

        MeasurementEntity measurement = measurementRepository
            .findByClientIdAndTypeCodeAndRecordedOn(request.clientId(), type.getCode(), recordedOn)
            .map(existing -> {
                existing.correctTo(request.value(), request.notes());
                return existing;
            })
            .orElseGet(() -> new MeasurementEntity(
                practitionerId, request.clientId(), type,
                request.value(), recordedOn, request.notes()));

        return MeasurementMapper.toDto(measurementRepository.save(measurement));
    }

    /** Several values from one session, entered in one go. */
    public List<MeasurementResponse> recordBatch(MeasurementBatchRequest request) {
        LocalDate recordedOn = request.recordedOn() == null ? LocalDate.now() : request.recordedOn();

        return request.values().stream()
            .map(entry -> record(new MeasurementRecordRequest(
                request.clientId(), entry.typeCode(), entry.value(), recordedOn, null)))
            .toList();
    }

    @Transactional(readOnly = true)
    public PagedResponse<MeasurementResponse> findForClient(Long clientId, Pageable pageable) {
        Long practitionerId = CurrentPractitioner.requireId();
        requireOwnClient(clientId);

        Page<MeasurementEntity> page = measurementRepository
            .findAllByPractitionerIdAndClientIdOrderByRecordedOnDesc(practitionerId, clientId, pageable);
        return PagedResponse.from(page.map(MeasurementMapper::toDto));
    }

    /**
     * The history of one measurement type, with the deltas a chart needs already worked out.
     */
    @Transactional(readOnly = true)
    public MeasurementSeriesResponse series(Long clientId, String typeCode) {
        Long practitionerId = CurrentPractitioner.requireId();
        requireOwnClient(clientId);

        MeasurementTypeEntity type = requireType(typeCode);
        List<MeasurementEntity> readings = measurementRepository
            .findAllByPractitionerIdAndClientIdAndTypeCodeOrderByRecordedOnAsc(
                practitionerId, clientId, type.getCode());

        List<MeasurementSeriesResponse.Point> points = new ArrayList<>();
        MeasurementEntity first = readings.isEmpty() ? null : readings.get(0);

        for (int i = 0; i < readings.size(); i++) {
            points.add(MeasurementMapper.toPoint(
                readings.get(i),
                i == 0 ? null : readings.get(i - 1),
                i == 0 ? null : first));
        }

        BigDecimal firstValue = first == null ? null : first.getValue();
        BigDecimal latestValue = readings.isEmpty()
            ? null : readings.get(readings.size() - 1).getValue();

        return new MeasurementSeriesResponse(
            type.getCode(),
            type.getLabelEl(),
            type.getUnit(),
            points,
            firstValue,
            latestValue,
            firstValue == null ? null : latestValue.subtract(firstValue)
        );
    }

    /** The latest reading of every type, plus BMI when weight and height are both known. */
    @Transactional(readOnly = true)
    public MeasurementSummaryResponse summary(Long clientId) {
        Long practitionerId = CurrentPractitioner.requireId();
        requireOwnClient(clientId);

        List<MeasurementEntity> all =
            measurementRepository.findAllByPractitionerIdAndClientId(practitionerId, clientId);

        // Latest per type, then ordered the way the types themselves are ordered.
        Map<String, MeasurementEntity> latestByType = all.stream()
            .collect(Collectors.toMap(
                measurement -> measurement.getType().getCode(),
                Function.identity(),
                (a, b) -> a.getRecordedOn().isAfter(b.getRecordedOn()) ? a : b));

        List<MeasurementEntity> latest = latestByType.values().stream()
            .sorted(Comparator.comparingInt(measurement -> measurement.getType().getSortOrder()))
            .toList();

        BigDecimal bmi = calculateBmi(
            latestByType.get("WEIGHT"),
            latestByType.get("HEIGHT"));

        return new MeasurementSummaryResponse(
            clientId,
            MeasurementMapper.toDtoList(latest),
            bmi,
            bmi == null ? null : classifyBmi(bmi)
        );
    }

    public boolean delete(Long id) {
        return measurementRepository.findByIdAndPractitionerId(id, CurrentPractitioner.requireId())
            .map(measurement -> {
                measurementRepository.delete(measurement);
                return true;
            })
            .orElse(false);
    }

    /**
     * BMI in kg/m². Returns null rather than guessing when either input is missing — a fabricated
     * BMI is worse than no BMI.
     */
    private BigDecimal calculateBmi(MeasurementEntity weight, MeasurementEntity height) {
        if (weight == null || height == null
            || height.getValue().compareTo(BigDecimal.ZERO) <= 0) {
            return null;
        }

        BigDecimal metres = Nutrients.divide(height.getValue(), new BigDecimal("100"));
        BigDecimal squared = metres.multiply(metres);
        return Nutrients.divide(weight.getValue(), squared).setScale(1, java.math.RoundingMode.HALF_UP);
    }

    /** Standard adult WHO cut-offs. Not applicable to children, who need growth references. */
    private String classifyBmi(BigDecimal bmi) {
        if (bmi.compareTo(new BigDecimal("18.5")) < 0) {
            return "UNDERWEIGHT";
        }
        if (bmi.compareTo(new BigDecimal("25")) < 0) {
            return "NORMAL";
        }
        if (bmi.compareTo(new BigDecimal("30")) < 0) {
            return "OVERWEIGHT";
        }
        return "OBESE";
    }

    /** Confirms the client belongs to the caller, through the client module's own scoping. */
    private void requireOwnClient(Long clientId) {
        clientService.findById(clientId)
            .orElseThrow(() -> new BusinessException("No such client"));
    }

    private MeasurementTypeEntity requireType(String code) {
        return Optional.ofNullable(code)
            .flatMap(value -> typeRepository.findByCode(value.trim().toUpperCase()))
            .orElseThrow(() -> new BusinessException("Unknown measurement type: " + code));
    }
}
