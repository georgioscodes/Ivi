package com.ivi.app.food.dto;

import java.math.BigDecimal;
import java.time.Instant;

public record FoodSuggestionResponse(
    Long id,
    Long foodId,
    String proposedNameEl,
    BigDecimal proposedEnergyKcal,
    BigDecimal proposedProteinG,
    BigDecimal proposedCarbohydrateG,
    BigDecimal proposedFatG,
    String rationale,
    String status,
    Instant createdAt,
    Instant reviewedAt
) {}
