package com.ivi.app.journal.mapper;

import com.ivi.app.journal.dto.JournalEntryResponse;
import com.ivi.app.journal.model.JournalEntryEntity;

import java.util.List;

public final class JournalEntryMapper {

    private JournalEntryMapper() {
        // Utility class — no instantiation
    }

    public static JournalEntryResponse toDto(JournalEntryEntity entry) {
        return new JournalEntryResponse(
            entry.getId(),
            entry.getClientId(),
            entry.getEntryDate(),
            entry.getTitle(),
            entry.getContent(),
            entry.getCreatedAt(),
            entry.getUpdatedAt()
        );
    }

    public static List<JournalEntryResponse> toDtoList(List<JournalEntryEntity> entries) {
        return entries.stream().map(JournalEntryMapper::toDto).toList();
    }
}
