package com.ivi.app.food.model;

/**
 * The grouping the plan builder organises foods by. Kept deliberately small: a practitioner
 * scanning a list needs a handful of buckets, not a taxonomy.
 */
public enum FoodCategory {
    FRESH,
    CARBOHYDRATE,
    PROTEIN,
    FAT,
    COMPOSITE
}
