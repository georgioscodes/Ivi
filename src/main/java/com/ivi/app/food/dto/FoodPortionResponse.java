package com.ivi.app.food.dto;

import java.math.BigDecimal;

public record FoodPortionResponse(
    Long id,
    String label,
    BigDecimal grams,
    boolean isDefault
) {}
