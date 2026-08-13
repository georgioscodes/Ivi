package com.ivi.app.audit.mapper;

import com.ivi.app.audit.dto.AuditLogResponse;
import com.ivi.app.audit.model.AuditLogEntity;

public final class AuditLogMapper {

    private AuditLogMapper() {
        // Utility class — no instantiation
    }

    public static AuditLogResponse toDto(AuditLogEntity entry) {
        return new AuditLogResponse(
            entry.getId(),
            entry.getClientId(),
            entry.getAction().name(),
            entry.getEntityType(),
            entry.getEntityId(),
            entry.getCorrelationId(),
            entry.getOccurredAt()
        );
    }
}
