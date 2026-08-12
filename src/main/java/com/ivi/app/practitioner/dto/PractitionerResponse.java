package com.ivi.app.practitioner.dto;

import java.time.Instant;

public record PractitionerResponse(
    Long id,
    String email,
    String displayName,
    String practiceName,
    Instant createdAt
) {}
