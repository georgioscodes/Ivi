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

    /**
     * The daily average against the plan's targets, per macro. Supplied for the same reason
     * {@code targetPercent} is supplied per day: the analysis panel compares every row against
     * target, and the average row is the one that answers whether the week as a whole works.
     */
    MacroTotals dailyAveragePercent,

    Long version,
    Instant createdAt,
    Instant updatedAt
) {}
