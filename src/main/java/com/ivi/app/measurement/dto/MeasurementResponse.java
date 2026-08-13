package com.ivi.app.measurement.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public record MeasurementResponse(
    Long id,
    Long clientId,
    String typeCode,
    String label,
    String unit,
    BigDecimal value,
    LocalDate recordedOn,
    String notes,

    /** Null when the type defines no healthy range, which is the case for anthropometrics. */
    Boolean outOfRange
) {}
