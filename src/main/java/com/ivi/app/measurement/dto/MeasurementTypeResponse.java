package com.ivi.app.measurement.dto;

import java.math.BigDecimal;

public record MeasurementTypeResponse(
    String code,
    String labelEl,
    String labelEn,
    String unit,
    String category,
    BigDecimal referenceMin,
    BigDecimal referenceMax,
    int decimals
) {}
