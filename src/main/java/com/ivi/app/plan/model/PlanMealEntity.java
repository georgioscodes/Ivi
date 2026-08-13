package com.ivi.app.plan.model;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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
@Table(name = "plan_meal")
public class PlanMealEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "plan_day_id", nullable = false)
    private PlanDayEntity day;

    @Enumerated(EnumType.STRING)
    @Column(name = "meal_type", nullable = false)
    private MealType mealType;

    /** e.g. "10:00", when the practitioner wants times rather than meal names on the printout. */
    @Column(name = "time_label")
    private String timeLabel;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @OneToMany(mappedBy = "meal", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sortOrder ASC, id ASC")
    private List<PlanItemEntity> items = new ArrayList<>();

    protected PlanMealEntity() {
        // JPA requires a no-arg constructor
    }

    public PlanMealEntity(MealType mealType, int sortOrder) {
        this.mealType = mealType;
        this.sortOrder = sortOrder;
    }

    void attachTo(PlanDayEntity day) {
        this.day = day;
    }

    public void addItem(PlanItemEntity item) {
        items.add(item);
        item.attachTo(this);
    }

    public boolean removeItem(Long itemId) {
        return items.removeIf(item -> item.getId() != null && item.getId().equals(itemId));
    }

    public BigDecimal totalEnergyKcal() {
        return sum(PlanItemEntity::getEnergyKcal);
    }

    public BigDecimal totalProteinG() {
        return sum(PlanItemEntity::getProteinG);
    }

    public BigDecimal totalCarbohydrateG() {
        return sum(PlanItemEntity::getCarbohydrateG);
    }

    public BigDecimal totalFatG() {
        return sum(PlanItemEntity::getFatG);
    }

    private BigDecimal sum(java.util.function.Function<PlanItemEntity, BigDecimal> field) {
        return items.stream().map(field).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    public Long getId() {
        return id;
    }

    public PlanDayEntity getDay() {
        return day;
    }

    public MealType getMealType() {
        return mealType;
    }

    public String getTimeLabel() {
        return timeLabel;
    }

    public void setTimeLabel(String timeLabel) {
        this.timeLabel = timeLabel;
    }

    public int getSortOrder() {
        return sortOrder;
    }

    public List<PlanItemEntity> getItems() {
        return items;
    }
}
