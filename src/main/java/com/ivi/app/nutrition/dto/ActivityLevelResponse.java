package com.ivi.app.nutrition.dto;

import java.math.BigDecimal;

/**
 * A suggested activity factor. Offered as a starting point only — the calculation accepts any
 * value in range, because practitioners routinely work between the textbook presets.
 */
public record ActivityLevelResponse(
    String code,
    BigDecimal factor,
    String labelEl,
    String labelEn
) {}
