package com.ivi.app.client.dto;

import java.time.Instant;
import java.time.LocalDate;

public record ClientResponse(
    Long id,
    String fullName,
    String email,
    String phone,
    LocalDate dateOfBirth,
    String goal,
    String notes,
    Instant createdAt,
    Instant updatedAt
) {}
