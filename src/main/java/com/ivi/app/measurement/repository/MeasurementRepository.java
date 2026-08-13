package com.ivi.app.measurement.repository;

import com.ivi.app.measurement.model.MeasurementEntity;
import com.ivi.app.shared.repository.TenantScopedRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/**
 * Measurements are tenant-owned, so this extends TenantScopedRepository and gets no unscoped
 * finder. Every method below additionally narrows to a client, because a measurement without
 * a client is meaningless.
 */
public interface MeasurementRepository extends TenantScopedRepository<MeasurementEntity, Long> {

    Page<MeasurementEntity> findAllByPractitionerIdAndClientIdOrderByRecordedOnDesc(
        Long practitionerId, Long clientId, Pageable pageable);

    /** The series behind a change chart, oldest first. */
    List<MeasurementEntity> findAllByPractitionerIdAndClientIdAndTypeCodeOrderByRecordedOnAsc(
        Long practitionerId, Long clientId, String typeCode);

    /** Used to decide whether recording a value is a new reading or a correction. */
    Optional<MeasurementEntity> findByClientIdAndTypeCodeAndRecordedOn(
        Long clientId, String typeCode, LocalDate recordedOn);

    List<MeasurementEntity> findAllByPractitionerIdAndClientId(Long practitionerId, Long clientId);
}
