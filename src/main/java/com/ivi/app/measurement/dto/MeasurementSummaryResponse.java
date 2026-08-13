package com.ivi.app.measurement.dto;

import java.math.BigDecimal;
import java.util.List;

/**
 * The latest value of every type recorded for a client — what a practitioner wants on screen
 * when the client sits down.
 */
public record MeasurementSummaryResponse(
    Long clientId,
    List<MeasurementResponse> latest,

    /**
     * Derived from the most recent weight and height when both exist, because it is asked for
     * constantly and recording it separately would let it drift out of step with its inputs.
     */
    BigDecimal bmi,
    String bmiCategory
) {}
