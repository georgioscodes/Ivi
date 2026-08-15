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

    /**
     * Used to decide whether recording a value is a new reading or a correction.
     *
     * <p>Scoped by practitioner like every other finder here. It was not, and the caller happened
     * to be safe — {@code record()} validates the client through the client service first, and a
     * client belongs to exactly one practitioner — but "safe because of what the caller does" is
     * not the guarantee this codebase is built on. The ArchUnit rule that enforces the convention
     * only inspects repositories extending {@code JpaRepository}, so it could not see this one.
     */
    Optional<MeasurementEntity> findByPractitionerIdAndClientIdAndTypeCodeAndRecordedOn(
        Long practitionerId, Long clientId, String typeCode, LocalDate recordedOn);

    List<MeasurementEntity> findAllByPractitionerIdAndClientId(Long practitionerId, Long clientId);
}
