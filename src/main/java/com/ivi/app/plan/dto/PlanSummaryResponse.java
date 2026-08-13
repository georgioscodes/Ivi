package com.ivi.app.plan.dto;

import java.math.BigDecimal;
import java.time.Instant;

/** List view. Deliberately excludes days so that listing plans never loads the whole aggregate. */
public record PlanSummaryResponse(
    Long id,
    Long clientId,
    String name,
    String status,
    BigDecimal targetKcal,
    int dayCount,
    Instant createdAt,
    Instant updatedAt
) {}
