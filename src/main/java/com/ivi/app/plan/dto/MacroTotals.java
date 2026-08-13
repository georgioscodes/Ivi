package com.ivi.app.plan.dto;

import java.math.BigDecimal;

public record MacroTotals(
    BigDecimal energyKcal,
    BigDecimal proteinG,
    BigDecimal carbohydrateG,
    BigDecimal fatG
) {}
