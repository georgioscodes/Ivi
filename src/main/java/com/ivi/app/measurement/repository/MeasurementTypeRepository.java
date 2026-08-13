package com.ivi.app.measurement.repository;

import com.ivi.app.measurement.model.MeasurementTypeEntity;
import org.springframework.data.repository.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Measurement types are shared reference data, not tenant-owned, so there is no tenant to
 * scope by. Read-only: types are created by migration, never by the application.
 */
public interface MeasurementTypeRepository extends Repository<MeasurementTypeEntity, Long> {

    Optional<MeasurementTypeEntity> findByCode(String code);

    List<MeasurementTypeEntity> findAllByOrderBySortOrderAsc();
}
