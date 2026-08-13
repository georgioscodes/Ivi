package com.ivi.app.nutrition.dto;

/**
 * Selects the sex-specific variant of a BMR equation.
 *
 * <p>This is an input to a published formula, which is why only the two variants those formulas
 * define are available. It is not a general statement about the person and is not stored on the
 * client record by this module.
 */
public enum Sex {
    MALE,
    FEMALE
}
