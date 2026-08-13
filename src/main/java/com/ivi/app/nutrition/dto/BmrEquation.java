package com.ivi.app.nutrition.dto;

/**
 * The published equation used to estimate basal metabolic rate.
 *
 * <p>More than one is offered because practitioners differ sharply in which they trust, and a
 * tool that supports only one loses the rest. Mifflin-St Jeor is generally the better default
 * for adults; the Harris-Benedict forms remain in wide use and are what many practitioners
 * were taught.
 */
public enum BmrEquation {
    HARRIS_BENEDICT_ORIGINAL,
    HARRIS_BENEDICT_REVISED,
    MIFFLIN_ST_JEOR
}
