package com.ivi.app.nutrition.dto;

import java.math.BigDecimal;

public record BmrResponse(
    BigDecimal bmrKcal,
    String equation
) {}
