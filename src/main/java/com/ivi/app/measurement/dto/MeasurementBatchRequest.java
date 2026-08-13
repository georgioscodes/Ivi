package com.ivi.app.measurement.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PastOrPresent;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Several values from one session, entered together.
 *
 * <p>The date is stated once rather than per row: a practitioner taking weight, waist and body
 * fat during a visit took them all on the same day, and repeating it per line is the sort of
 * friction this feature exists to remove.
 */
public record MeasurementBatchRequest(

    @NotNull(message = "Client is required")
    Long clientId,

    @PastOrPresent(message = "A measurement cannot be recorded in the future")
    LocalDate recordedOn,

    @NotEmpty(message = "At least one value is required")
    @Valid
    List<Entry> values
) {

    public record Entry(
        @NotNull(message = "Measurement type is required")
        String typeCode,

        @NotNull(message = "Value is required")
        BigDecimal value
    ) {}
}
