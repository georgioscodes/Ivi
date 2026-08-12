package com.ivi.app.shared.exception;

import java.time.LocalDateTime;
import java.util.Map;

public record ErrorResponse(
    int status,
    String message,
    LocalDateTime timestamp,
    Map<String, String> errors
) {

    public ErrorResponse(int status, String message) {
        this(status, message, LocalDateTime.now(), Map.of());
    }
}
