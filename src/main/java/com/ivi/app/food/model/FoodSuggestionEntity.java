package com.ivi.app.food.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * A proposed change to the shared catalogue.
 *
 * <p>Distinct from an override: an override is private and immediate, whereas a suggestion asks
 * for the default itself to change and waits for review. A practitioner who disagrees with a
 * value normally wants both — their own number now, and the catalogue corrected eventually.
 */
@Entity
@Table(name = "food_suggestion")
public class FoodSuggestionEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "food_id", nullable = false, updatable = false)
    private Long foodId;

    @Column(name = "practitioner_id", nullable = false, updatable = false)
    private Long practitionerId;

    @Column(name = "proposed_name_el")
    private String proposedNameEl;

    @Column(name = "proposed_energy_kcal")
    private BigDecimal proposedEnergyKcal;

    @Column(name = "proposed_protein_g")
    private BigDecimal proposedProteinG;

    @Column(name = "proposed_carbohydrate_g")
    private BigDecimal proposedCarbohydrateG;

    @Column(name = "proposed_fat_g")
    private BigDecimal proposedFatG;

    @Column(columnDefinition = "text")
    private String rationale;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private SuggestionStatus status;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "reviewed_at")
    private Instant reviewedAt;

    protected FoodSuggestionEntity() {
        // JPA requires a no-arg constructor
    }

    public FoodSuggestionEntity(Long foodId, Long practitionerId, String proposedNameEl,
                                BigDecimal proposedEnergyKcal, BigDecimal proposedProteinG,
                                BigDecimal proposedCarbohydrateG, BigDecimal proposedFatG,
                                String rationale) {
        this.foodId = foodId;
        this.practitionerId = practitionerId;
        this.proposedNameEl = proposedNameEl;
        this.proposedEnergyKcal = proposedEnergyKcal;
        this.proposedProteinG = proposedProteinG;
        this.proposedCarbohydrateG = proposedCarbohydrateG;
        this.proposedFatG = proposedFatG;
        this.rationale = rationale;
        this.status = SuggestionStatus.PENDING;
        this.createdAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public Long getFoodId() {
        return foodId;
    }

    public Long getPractitionerId() {
        return practitionerId;
    }

    public String getProposedNameEl() {
        return proposedNameEl;
    }

    public BigDecimal getProposedEnergyKcal() {
        return proposedEnergyKcal;
    }

    public BigDecimal getProposedProteinG() {
        return proposedProteinG;
    }

    public BigDecimal getProposedCarbohydrateG() {
        return proposedCarbohydrateG;
    }

    public BigDecimal getProposedFatG() {
        return proposedFatG;
    }

    public String getRationale() {
        return rationale;
    }

    public SuggestionStatus getStatus() {
        return status;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getReviewedAt() {
        return reviewedAt;
    }
}
