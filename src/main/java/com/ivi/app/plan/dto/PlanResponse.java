package com.ivi.app.plan.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record PlanResponse(
    Long id,
    Long clientId,
    String name,
    String status,
    MacroTotals targets,
    String basis,
    BigDecimal activityFactor,
    String notes,
    List<PlanDayResponse> days,

    /** Mean per day across the plan — the weekly average shown on the analysis screen. */
    MacroTotals dailyAverage,

    Long version,
    Instant createdAt,
    Instant updatedAt
) {}
