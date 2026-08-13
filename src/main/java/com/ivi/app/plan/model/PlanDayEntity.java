package com.ivi.app.plan.model;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "plan_day")
public class PlanDayEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "plan_id", nullable = false)
    private PlanEntity plan;

    /** Zero-based. Day 0 is Monday when the plan is a literal week. */
    @Column(name = "day_index", nullable = false)
    private int dayIndex;

    @Column(name = "label_override")
    private String labelOverride;

    @OneToMany(mappedBy = "day", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sortOrder ASC, id ASC")
    private List<PlanMealEntity> meals = new ArrayList<>();

    protected PlanDayEntity() {
        // JPA requires a no-arg constructor
    }

    public PlanDayEntity(int dayIndex) {
        this.dayIndex = dayIndex;
    }

    void attachTo(PlanEntity plan) {
        this.plan = plan;
    }

    public void addMeal(PlanMealEntity meal) {
        meals.add(meal);
        meal.attachTo(this);
    }

    /** Empties the day without removing its meal structure. */
    public void clearItems() {
        meals.forEach(meal -> meal.getItems().clear());
    }

    public BigDecimal totalEnergyKcal() {
        return sum(PlanMealEntity::totalEnergyKcal);
    }

    public BigDecimal totalProteinG() {
        return sum(PlanMealEntity::totalProteinG);
    }

    public BigDecimal totalCarbohydrateG() {
        return sum(PlanMealEntity::totalCarbohydrateG);
    }

    public BigDecimal totalFatG() {
        return sum(PlanMealEntity::totalFatG);
    }

    private BigDecimal sum(java.util.function.Function<PlanMealEntity, BigDecimal> field) {
        return meals.stream().map(field).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    public Long getId() {
        return id;
    }

    public PlanEntity getPlan() {
        return plan;
    }

    public int getDayIndex() {
        return dayIndex;
    }

    public String getLabelOverride() {
        return labelOverride;
    }

    public void setLabelOverride(String labelOverride) {
        this.labelOverride = labelOverride;
    }

    public List<PlanMealEntity> getMeals() {
        return meals;
    }
}
