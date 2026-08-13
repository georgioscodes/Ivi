package com.ivi.app.plan.dto;

import java.math.BigDecimal;

public record PlanItemResponse(
    Long id,
    Long foodId,
    String name,
    String portionLabel,
    BigDecimal portionGrams,
    BigDecimal quantity,
    BigDecimal totalGrams,
    BigDecimal energyKcal,
    BigDecimal proteinG,
    BigDecimal carbohydrateG,
    BigDecimal fatG,
    int sortOrder
) {}
