package com.ivi.app.food.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.math.BigDecimal;

/**
 * A natural unit for a food — a slice, a tablespoon, a medium one — and what it weighs.
 * The arithmetic always runs on grams; the label is what the practitioner sees.
 */
@Entity
@Table(name = "food_portion")
public class FoodPortionEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "food_id", nullable = false)
    private FoodEntity food;

    @Column(name = "label_el", nullable = false)
    private String labelEl;

    @Column(nullable = false)
    private BigDecimal grams;

    @Column(name = "is_default", nullable = false)
    private boolean isDefault;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    protected FoodPortionEntity() {
        // JPA requires a no-arg constructor
    }

    public FoodPortionEntity(String labelEl, BigDecimal grams, boolean isDefault, int sortOrder) {
        this.labelEl = labelEl;
        this.grams = grams;
        this.isDefault = isDefault;
        this.sortOrder = sortOrder;
    }

    void attachTo(FoodEntity food) {
        this.food = food;
    }

    public Long getId() {
        return id;
    }

    public String getLabelEl() {
        return labelEl;
    }

    public BigDecimal getGrams() {
        return grams;
    }

    public boolean isDefault() {
        return isDefault;
    }

    public int getSortOrder() {
        return sortOrder;
    }
}
