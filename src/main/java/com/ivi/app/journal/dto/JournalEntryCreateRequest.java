package com.ivi.app.journal.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record JournalEntryCreateRequest(

    @NotNull(message = "Client is required")
    Long clientId,

    /** Defaults to today, which is the common case at the end of a consultation. */
    @PastOrPresent(message = "An entry cannot be dated in the future")
    LocalDate entryDate,

    @Size(max = 200, message = "Title must be at most 200 characters")
    String title,

    @NotBlank(message = "Content is required")
    String content
) {}
