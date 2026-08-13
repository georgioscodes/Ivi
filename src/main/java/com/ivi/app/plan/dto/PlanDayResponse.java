package com.ivi.app.plan.dto;

import java.util.List;

public record PlanDayResponse(
    Long id,
    int dayIndex,
    String label,
    List<PlanMealResponse> meals,
    MacroTotals totals,

    /**
     * Progress against the plan's targets, as a percentage per macro. This is what drives the
     * progress bars while a plan is being built, and the server is the authority on it.
     */
    MacroTotals targetPercent
) {}
