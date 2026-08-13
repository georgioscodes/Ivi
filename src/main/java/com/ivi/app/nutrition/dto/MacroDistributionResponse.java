package com.ivi.app.nutrition.dto;

import java.math.BigDecimal;

public record MacroDistributionResponse(
    BigDecimal targetKcal,
    BigDecimal carbohydrateG,
    BigDecimal proteinG,
    BigDecimal fatG,
    BigDecimal carbohydrateKcal,
    BigDecimal proteinKcal,
    BigDecimal fatKcal
) {}
