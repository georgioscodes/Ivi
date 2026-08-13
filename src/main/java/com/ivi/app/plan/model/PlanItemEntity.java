package com.ivi.app.plan.model;

import com.ivi.app.shared.util.Nutrients;
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
 * One food in one meal, with its contribution already worked out.
 *
 * <p>Everything needed to render and total this line is stored on the row: the food's name, the
 * portion label and weight, and all four macro figures. Nothing is looked up from the catalogue
 * at read time.
 *
 * <p>That is deliberate. An issued plan is a clinical document. If the catalogue is corrected next
 * month, a plan a client has been following since last month must not silently change underneath
 * them, and the PDF in their inbox must still match what the practitioner sees. The cost is
 * denormalisation; the benefit is that a plan means the same thing forever.
 */
@Entity
@Table(name = "plan_item")
public class PlanItemEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "plan_meal_id", nullable = false)
    private PlanMealEntity meal;

    /**
     * Soft reference to the catalogue. Null once the food is deleted — the item survives,
     * because the prescription is a fact about the past and does not stop being true.
     */
    @Column(name = "food_id")
    private Long foodId;

    @Column(name = "food_name", nullable = false)
    private String foodName;

    /** What the practitioner wants printed instead, e.g. "αρνί σπάλα" for a generic lamb entry. */
    @Column(name = "name_override")
    private String nameOverride;

    @Column(name = "portion_label", nullable = false)
    private String portionLabel;

    @Column(name = "portion_grams", nullable = false)
    private BigDecimal portionGrams;

    @Column(nullable = false)
    private BigDecimal quantity;

    // The composition snapshot. Everything below is derived from these four figures.
    @Column(name = "energy_per_100g", nullable = false)
    private BigDecimal energyPer100g;

    @Column(name = "protein_per_100g", nullable = false)
    private BigDecimal proteinPer100g;

    @Column(name = "carbohydrate_per_100g", nullable = false)
    private BigDecimal carbohydratePer100g;

    @Column(name = "fat_per_100g", nullable = false)
    private BigDecimal fatPer100g;

    @Column(name = "energy_kcal", nullable = false)
    private BigDecimal energyKcal;

    @Column(name = "protein_g", nullable = false)
    private BigDecimal proteinG;

    @Column(name = "carbohydrate_g", nullable = false)
    private BigDecimal carbohydrateG;

    @Column(name = "fat_g", nullable = false)
    private BigDecimal fatG;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    protected PlanItemEntity() {
        // JPA requires a no-arg constructor
    }

    public PlanItemEntity(Long foodId, String foodName, String portionLabel, BigDecimal portionGrams,
                          BigDecimal quantity, BigDecimal energyPer100g, BigDecimal proteinPer100g,
                          BigDecimal carbohydratePer100g, BigDecimal fatPer100g, int sortOrder) {
        this.foodId = foodId;
        this.foodName = foodName;
        this.portionLabel = portionLabel;
        this.portionGrams = portionGrams;
        this.quantity = quantity;
        this.sortOrder = sortOrder;
        this.energyPer100g = energyPer100g;
        this.proteinPer100g = proteinPer100g;
        this.carbohydratePer100g = carbohydratePer100g;
        this.fatPer100g = fatPer100g;
        recalculate();
    }

    /**
     * Recomputes this line's contribution from per-100g figures.
     *
     * <p>grams = portion weight x quantity, and each macro is that mass over 100 times the
     * per-100g figure. Division happens at working precision and is not rounded here: rounding
     * between accumulation steps is what makes a column of numbers fail to add up to its own total.
     */
    private void recalculate() {
        BigDecimal grams = portionGrams.multiply(quantity);
        BigDecimal factor = Nutrients.divide(grams, new BigDecimal("100"));

        this.energyKcal = energyPer100g.multiply(factor);
        this.proteinG = proteinPer100g.multiply(factor);
        this.carbohydrateG = carbohydratePer100g.multiply(factor);
        this.fatG = fatPer100g.multiply(factor);
    }

    /**
     * Changes the amount and recomputes from the stored composition.
     *
     * <p>Recomputed from the per-100g snapshot rather than rescaled from the current absolute
     * figures. Rescaling would round the ratio on every change, so adjusting a quantity up and
     * back down would not return the original number — rounding between accumulation steps,
     * which is exactly what the rounding contract forbids.
     *
     * <p>The catalogue is still never consulted: the composition is the one captured when the
     * item was added, so changing an amount cannot pull in a value that has moved since.
     */
    public void changeQuantity(BigDecimal newQuantity) {
        this.quantity = newQuantity;
        recalculate();
    }

    void attachTo(PlanMealEntity meal) {
        this.meal = meal;
    }

    public Long getId() {
        return id;
    }

    public PlanMealEntity getMeal() {
        return meal;
    }

    public Long getFoodId() {
        return foodId;
    }

    public String getFoodName() {
        return foodName;
    }

    /** What should actually be printed: the override if there is one, otherwise the food name. */
    public String getDisplayName() {
        return nameOverride == null || nameOverride.isBlank() ? foodName : nameOverride;
    }

    public String getNameOverride() {
        return nameOverride;
    }

    public void setNameOverride(String nameOverride) {
        this.nameOverride = nameOverride;
    }

    public String getPortionLabel() {
        return portionLabel;
    }

    public BigDecimal getPortionGrams() {
        return portionGrams;
    }

    public BigDecimal getQuantity() {
        return quantity;
    }

    public BigDecimal getTotalGrams() {
        return portionGrams.multiply(quantity);
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

    public BigDecimal getEnergyPer100g() {
        return energyPer100g;
    }

    public int getSortOrder() {
        return sortOrder;
    }

    public void setSortOrder(int sortOrder) {
        this.sortOrder = sortOrder;
    }
}
