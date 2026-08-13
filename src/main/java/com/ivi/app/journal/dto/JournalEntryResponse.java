package com.ivi.app.journal.dto;

import java.time.Instant;
import java.time.LocalDate;

public record JournalEntryResponse(
    Long id,
    Long clientId,
    LocalDate entryDate,
    String title,
    String content,
    Instant createdAt,
    Instant updatedAt
) {}
