package com.ivi.app.measurement.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;

/**
 * What can be measured. Reference data, shared by every practitioner.
 */
@Entity
@Table(name = "measurement_type")
public class MeasurementTypeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String code;

    @Column(name = "label_el", nullable = false)
    private String labelEl;

    @Column(name = "label_en", nullable = false)
    private String labelEn;

    @Column(nullable = false)
    private String unit;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private MeasurementCategory category;

    @Column(name = "reference_min")
    private BigDecimal referenceMin;

    @Column(name = "reference_max")
    private BigDecimal referenceMax;

    @Column(nullable = false)
    private int decimals;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    protected MeasurementTypeEntity() {
        // JPA requires a no-arg constructor
    }

    /**
     * Whether a value sits outside the healthy range, when the type defines one.
     * Empty means the question does not apply — there is no "out of range" body weight.
     */
    public java.util.Optional<Boolean> isOutOfRange(BigDecimal value) {
        if (referenceMin == null && referenceMax == null) {
            return java.util.Optional.empty();
        }
        boolean below = referenceMin != null && value.compareTo(referenceMin) < 0;
        boolean above = referenceMax != null && value.compareTo(referenceMax) > 0;
        return java.util.Optional.of(below || above);
    }

    public Long getId() {
        return id;
    }

    public String getCode() {
        return code;
    }

    public String getLabelEl() {
        return labelEl;
    }

    public String getLabelEn() {
        return labelEn;
    }

    public String getUnit() {
        return unit;
    }

    public MeasurementCategory getCategory() {
        return category;
    }

    public BigDecimal getReferenceMin() {
        return referenceMin;
    }

    public BigDecimal getReferenceMax() {
        return referenceMax;
    }

    public int getDecimals() {
        return decimals;
    }

    public int getSortOrder() {
        return sortOrder;
    }
}
