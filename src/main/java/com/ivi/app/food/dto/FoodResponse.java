package com.ivi.app.food.dto;

import java.math.BigDecimal;
import java.util.List;

public record FoodResponse(
    Long id,
    String nameEl,
    String nameEn,
    String category,
    BigDecimal energyKcal,
    BigDecimal proteinG,
    BigDecimal carbohydrateG,
    BigDecimal fatG,
    String source,
    List<FoodPortionResponse> portions,

    /** True when this row belongs to the shared catalogue rather than to the practitioner. */
    boolean global,

    /**
     * True when the practitioner is seeing their own edited values in place of a catalogue
     * default. The client uses this to show that a food has been customised.
     */
    boolean overridden,

    /** The catalogue food this overrides, so the client can offer "revert to default". */
    Long overridesFoodId
) {}
