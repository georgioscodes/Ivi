package com.ivi.app.food.model;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * A food, which is one of three things depending on who owns it:
 *
 * <ul>
 *   <li><strong>global</strong> — {@code practitionerId} null: the shared catalogue</li>
 *   <li><strong>custom</strong> — owned by a practitioner, theirs alone</li>
 *   <li><strong>override</strong> — owned by a practitioner and replacing a global food for them</li>
 * </ul>
 *
 * <p>An override is copy-on-write: it holds a complete set of values rather than a diff, so a row
 * always answers "what are this food's numbers" on its own.
 */
@Entity
@Table(name = "food")
public class FoodEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Null for the shared catalogue. Set once and never reassigned. */
    @Column(name = "practitioner_id", updatable = false)
    private Long practitionerId;

    /** The global food this row replaces, for its owner only. Null unless this is an override. */
    @Column(name = "overrides_food_id", updatable = false)
    private Long overridesFoodId;

    @Column(name = "name_el", nullable = false)
    private String nameEl;

    @Column(name = "name_en")
    private String nameEn;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private FoodCategory category;

    // BigDecimal throughout. Floating-point drift across hundreds of additions in the plan
    // builder is visible to the user and destroys confidence in the totals.
    @Column(name = "energy_kcal", nullable = false)
    private BigDecimal energyKcal;

    @Column(name = "protein_g", nullable = false)
    private BigDecimal proteinG;

    @Column(name = "carbohydrate_g", nullable = false)
    private BigDecimal carbohydrateG;

    @Column(name = "fat_g", nullable = false)
    private BigDecimal fatG;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private FoodSource source;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    @Version
    private Long version;

    @OneToMany(mappedBy = "food", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sortOrder ASC")
    private List<FoodPortionEntity> portions = new ArrayList<>();

    protected FoodEntity() {
        // JPA requires a no-arg constructor
    }

    private FoodEntity(Long practitionerId, Long overridesFoodId, String nameEl, FoodCategory category,
                       BigDecimal energyKcal, BigDecimal proteinG, BigDecimal carbohydrateG, BigDecimal fatG) {
        this.practitionerId = practitionerId;
        this.overridesFoodId = overridesFoodId;
        this.nameEl = nameEl;
        this.category = category;
        this.energyKcal = energyKcal;
        this.proteinG = proteinG;
        this.carbohydrateG = carbohydrateG;
        this.fatG = fatG;
        this.source = FoodSource.PRACTITIONER;
        this.createdAt = Instant.now();
    }

    /** A food a practitioner adds for themselves. */
    public static FoodEntity custom(Long practitionerId, String nameEl, FoodCategory category,
                                    BigDecimal energyKcal, BigDecimal proteinG,
                                    BigDecimal carbohydrateG, BigDecimal fatG) {
        return new FoodEntity(practitionerId, null, nameEl, category,
            energyKcal, proteinG, carbohydrateG, fatG);
    }

    /**
     * A practitioner's replacement for a global food. Values are copied in full at creation,
     * so the override keeps working even if the global row later changes.
     */
    public static FoodEntity override(Long practitionerId, FoodEntity global, String nameEl,
                                      FoodCategory category, BigDecimal energyKcal, BigDecimal proteinG,
                                      BigDecimal carbohydrateG, BigDecimal fatG) {
        return new FoodEntity(practitionerId, global.getId(), nameEl, category,
            energyKcal, proteinG, carbohydrateG, fatG);
    }

    public Long getId() {
        return id;
    }

    public Long getPractitionerId() {
        return practitionerId;
    }

    public Long getOverridesFoodId() {
        return overridesFoodId;
    }

    /** True when this row belongs to the shared catalogue rather than to a practitioner. */
    public boolean isGlobal() {
        return practitionerId == null;
    }

    public boolean isOverride() {
        return overridesFoodId != null;
    }

    public String getNameEl() {
        return nameEl;
    }

    public void setNameEl(String nameEl) {
        this.nameEl = nameEl;
        touch();
    }

    public String getNameEn() {
        return nameEn;
    }

    public void setNameEn(String nameEn) {
        this.nameEn = nameEn;
        touch();
    }

    public FoodCategory getCategory() {
        return category;
    }

    public void setCategory(FoodCategory category) {
        this.category = category;
        touch();
    }

    public BigDecimal getEnergyKcal() {
        return energyKcal;
    }

    public BigDecimal getProteinG() {
        return proteinG;
    }

    public BigDecimal getCarbohydrateG() {
        return carbohydrateG;
    }

    public BigDecimal getFatG() {
        return fatG;
    }

    public void setMacros(BigDecimal energyKcal, BigDecimal proteinG,
                          BigDecimal carbohydrateG, BigDecimal fatG) {
        this.energyKcal = energyKcal;
        this.proteinG = proteinG;
        this.carbohydrateG = carbohydrateG;
        this.fatG = fatG;
        touch();
    }

    public FoodSource getSource() {
        return source;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public List<FoodPortionEntity> getPortions() {
        return portions;
    }

    public void addPortion(FoodPortionEntity portion) {
        portions.add(portion);
        portion.attachTo(this);
    }

    private void touch() {
        this.updatedAt = Instant.now();
    }
}
