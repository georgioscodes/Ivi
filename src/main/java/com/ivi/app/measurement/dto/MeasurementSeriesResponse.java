package com.ivi.app.measurement.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * A type's history for one client: the data behind a change chart.
 */
public record MeasurementSeriesResponse(
    String typeCode,
    String label,
    String unit,
    List<Point> points,

    BigDecimal firstValue,
    BigDecimal latestValue,

    /** Latest minus first. Negative means the value has come down. */
    BigDecimal totalChange
) {

    public record Point(
        LocalDate recordedOn,
        BigDecimal value,

        /** Change since the previous reading. Null on the first point. */
        BigDecimal changeFromPrevious,

        /** Change since the first reading, which is what progress is usually judged against. */
        BigDecimal changeFromFirst
    ) {}
}
