package com.ivi.app.plan.model;

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
import java.util.Optional;

/**
 * The aggregate root of a diet plan.
 *
 * <p>Targets are copied onto the plan rather than recalculated on read. The practitioner may have
 * reached them by any of the nutrition module's routes, and the plan must keep meaning the same
 * thing after the client's weight changes.
 */
@Entity
@Table(name = "plan")
public class PlanEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "practitioner_id", nullable = false, updatable = false)
    private Long practitionerId;

    @Column(name = "client_id", nullable = false, updatable = false)
    private Long clientId;

    @Column(nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PlanStatus status;

    @Column(name = "target_kcal", nullable = false)
    private BigDecimal targetKcal;

    @Column(name = "target_protein_g", nullable = false)
    private BigDecimal targetProteinG;

    @Column(name = "target_carbohydrate_g", nullable = false)
    private BigDecimal targetCarbohydrateG;

    @Column(name = "target_fat_g", nullable = false)
    private BigDecimal targetFatG;

    /** How the target was arrived at, e.g. MIFFLIN_ST_JEOR or DIRECT. Kept for the record. */
    private String basis;

    @Column(name = "activity_factor")
    private BigDecimal activityFactor;

    @Column(columnDefinition = "text")
    private String notes;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    /**
     * Optimistic locking. The builder is a long editing session and the same practitioner may
     * have a plan open on a laptop and a tablet at once — an access pattern the product
     * explicitly invites. Last-write-wins would silently discard whichever they saved first.
     */
    @Version
    private Long version;

    @OneToMany(mappedBy = "plan", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("dayIndex ASC")
    private List<PlanDayEntity> days = new ArrayList<>();

    protected PlanEntity() {
        // JPA requires a no-arg constructor
    }

    public PlanEntity(Long practitionerId, Long clientId, String name, BigDecimal targetKcal,
                      BigDecimal targetProteinG, BigDecimal targetCarbohydrateG, BigDecimal targetFatG) {
        this.practitionerId = practitionerId;
        this.clientId = clientId;
        this.name = name;
        this.status = PlanStatus.DRAFT;
        this.targetKcal = targetKcal;
        this.targetProteinG = targetProteinG;
        this.targetCarbohydrateG = targetCarbohydrateG;
        this.targetFatG = targetFatG;
        this.createdAt = Instant.now();
    }

    public void addDay(PlanDayEntity day) {
        days.add(day);
        day.attachTo(this);
        touch();
    }

    public Optional<PlanDayEntity> findDay(int dayIndex) {
        return days.stream().filter(day -> day.getDayIndex() == dayIndex).findFirst();
    }

    public Optional<PlanMealEntity> findMeal(Long mealId) {
        return days.stream()
            .flatMap(day -> day.getMeals().stream())
            .filter(meal -> meal.getId() != null && meal.getId().equals(mealId))
            .findFirst();
    }

    public Optional<PlanItemEntity> findItem(Long itemId) {
        return days.stream()
            .flatMap(day -> day.getMeals().stream())
            .flatMap(meal -> meal.getItems().stream())
            .filter(item -> item.getId() != null && item.getId().equals(itemId))
            .findFirst();
    }

    public BigDecimal totalEnergyKcal() {
        return days.stream().map(PlanDayEntity::totalEnergyKcal)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    /** Mean per day, which is what the weekly average on the analysis screen shows. */
    public BigDecimal averageDailyEnergyKcal() {
        if (days.isEmpty()) {
            return BigDecimal.ZERO;
        }
        return com.ivi.app.shared.util.Nutrients.divide(
            totalEnergyKcal(), BigDecimal.valueOf(days.size()));
    }

    public Long getId() {
        return id;
    }

    public Long getPractitionerId() {
        return practitionerId;
    }

    public Long getClientId() {
        return clientId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
        touch();
    }

    public PlanStatus getStatus() {
        return status;
    }

    public void setStatus(PlanStatus status) {
        this.status = status;
        touch();
    }

    public BigDecimal getTargetKcal() {
        return targetKcal;
    }

    public BigDecimal getTargetProteinG() {
        return targetProteinG;
    }

    public BigDecimal getTargetCarbohydrateG() {
        return targetCarbohydrateG;
    }

    public BigDecimal getTargetFatG() {
        return targetFatG;
    }

    public void setTargets(BigDecimal kcal, BigDecimal protein, BigDecimal carbohydrate, BigDecimal fat) {
        this.targetKcal = kcal;
        this.targetProteinG = protein;
        this.targetCarbohydrateG = carbohydrate;
        this.targetFatG = fat;
        touch();
    }

    public String getBasis() {
        return basis;
    }

    public void setBasis(String basis) {
        this.basis = basis;
    }

    public BigDecimal getActivityFactor() {
        return activityFactor;
    }

    public void setActivityFactor(BigDecimal activityFactor) {
        this.activityFactor = activityFactor;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
        touch();
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public Long getVersion() {
        return version;
    }

    public List<PlanDayEntity> getDays() {
        return days;
    }

    public void touch() {
        this.updatedAt = Instant.now();
    }
}
