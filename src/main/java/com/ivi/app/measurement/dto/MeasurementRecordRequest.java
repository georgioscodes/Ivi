package com.ivi.app.measurement.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;

public record MeasurementRecordRequest(

    @NotNull(message = "Client is required")
    Long clientId,

    @NotBlank(message = "Measurement type is required")
    String typeCode,

    @NotNull(message = "Value is required")
    BigDecimal value,

    /** Defaults to today when omitted, which is the common case at a consultation. */
    @PastOrPresent(message = "A measurement cannot be recorded in the future")
    LocalDate recordedOn,

    @Size(max = 500, message = "Notes must be at most 500 characters")
    String notes
) {}
