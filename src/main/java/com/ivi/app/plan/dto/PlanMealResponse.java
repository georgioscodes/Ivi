package com.ivi.app.plan.dto;

import java.util.List;

public record PlanMealResponse(
    Long id,
    String mealType,
    String timeLabel,
    int sortOrder,
    List<PlanItemResponse> items,
    MacroTotals totals
) {}
