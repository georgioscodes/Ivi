package com.ivi.app.audit.dto;

import java.time.Instant;

public record AuditLogResponse(
    Long id,
    Long clientId,
    String action,
    String entityType,
    Long entityId,
    String correlationId,
    Instant occurredAt
) {}
