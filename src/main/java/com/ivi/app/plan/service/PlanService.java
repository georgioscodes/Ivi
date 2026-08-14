package com.ivi.app.plan.service;

import com.ivi.app.client.service.ClientService;
import com.ivi.app.food.dto.FoodPortionResponse;
import com.ivi.app.food.dto.FoodResponse;
import com.ivi.app.food.service.FoodService;
import com.ivi.app.plan.dto.PlanCreateRequest;
import com.ivi.app.plan.dto.PlanItemAddRequest;
import com.ivi.app.plan.dto.PlanItemUpdateRequest;
import com.ivi.app.plan.dto.PlanResponse;
import com.ivi.app.plan.dto.PlanSummaryResponse;
import com.ivi.app.plan.mapper.PlanMapper;
import com.ivi.app.plan.model.MealType;
import com.ivi.app.plan.model.PlanDayEntity;
import com.ivi.app.plan.model.PlanEntity;
import com.ivi.app.plan.model.PlanItemEntity;
import com.ivi.app.plan.model.PlanMealEntity;
import com.ivi.app.plan.model.PlanStatus;
import com.ivi.app.plan.repository.PlanRepository;
import com.ivi.app.shared.dto.PagedResponse;
import com.ivi.app.shared.exception.BusinessException;
import com.ivi.app.shared.security.CurrentPractitioner;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

/**
 * The plan builder.
 *
 * <p>Reaches the food catalogue and client records through their services rather than their
 * repositories, which is what keeps the modules separable. That also means food visibility is
 * resolved by the food module itself: a practitioner adding an overridden food gets <em>their</em>
 * values, without this module knowing overrides exist.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class PlanService {

    /** The meal structure a new day is scaffolded with. */
    private static final List<MealType> DEFAULT_MEALS = List.of(
        MealType.BREAKFAST,
        MealType.MORNING_SNACK,
        MealType.LUNCH,
        MealType.AFTERNOON_SNACK,
        MealType.DINNER
    );

    private final PlanRepository planRepository;
    private final FoodService foodService;
    private final ClientService clientService;

    public PlanResponse create(PlanCreateRequest request) {
        Long practitionerId = CurrentPractitioner.requireId();

        // Resolved through the client module's service, which is already tenant-scoped, so a
        // plan cannot be attached to somebody else's client.
        clientService.findById(request.clientId())
            .orElseThrow(() -> new BusinessException("No such client"));

        PlanEntity plan = new PlanEntity(
            practitionerId,
            request.clientId(),
            request.name().trim(),
            request.targetKcal(),
            request.targetProteinG(),
            request.targetCarbohydrateG(),
            request.targetFatG()
        );
        plan.setBasis(request.basis());
        plan.setActivityFactor(request.activityFactor());

        for (int dayIndex = 0; dayIndex < request.dayCount(); dayIndex++) {
            plan.addDay(scaffoldDay(dayIndex));
        }

        return PlanMapper.toDto(planRepository.save(plan));
    }

    @Transactional(readOnly = true)
    public Optional<PlanResponse> findById(Long id) {
        return load(id).map(PlanMapper::toDto);
    }

    @Transactional(readOnly = true)
    public PagedResponse<PlanSummaryResponse> findAll(Pageable pageable) {
        Page<PlanEntity> page =
            planRepository.findAllByPractitionerId(CurrentPractitioner.requireId(), pageable);
        return PagedResponse.from(page.map(PlanMapper::toSummaryDto));
    }

    @Transactional(readOnly = true)
    public PagedResponse<PlanSummaryResponse> findByClient(Long clientId, Pageable pageable) {
        Page<PlanEntity> page = planRepository.findAllByPractitionerIdAndClientId(
            CurrentPractitioner.requireId(), clientId, pageable);
        return PagedResponse.from(page.map(PlanMapper::toSummaryDto));
    }

    /**
     * Adds a food to a meal, snapshotting its composition onto the item.
     *
     * <p>The food is resolved through the food service, so an overridden catalogue food
     * contributes the practitioner's own values.
     */
    public Optional<PlanResponse> addItem(Long planId, Long mealId, PlanItemAddRequest request) {
        return load(planId).map(plan -> {
            PlanMealEntity meal = plan.findMeal(mealId)
                .orElseThrow(() -> new BusinessException("That meal is not part of this plan"));

            FoodResponse food = foodService.findById(request.foodId())
                .orElseThrow(() -> new BusinessException("No such food"));

            FoodPortionResponse portion = choosePortion(food, request.portionId());

            meal.addItem(new PlanItemEntity(
                food.id(),
                food.nameEl(),
                portion.label(),
                portion.grams(),
                request.quantity(),
                food.energyKcal(),
                food.proteinG(),
                food.carbohydrateG(),
                food.fatG(),
                meal.getItems().size()
            ));

            plan.touch();
            return PlanMapper.toDto(planRepository.save(plan));
        });
    }

    public Optional<PlanResponse> updateItem(Long planId, Long itemId, PlanItemUpdateRequest request) {
        return load(planId).map(plan -> {
            PlanItemEntity item = plan.findItem(itemId)
                .orElseThrow(() -> new BusinessException("That item is not part of this plan"));

            if (request.quantity() != null) {
                item.changeQuantity(request.quantity());
            }
            if (request.nameOverride() != null) {
                item.setNameOverride(request.nameOverride().isBlank() ? null : request.nameOverride().trim());
            }

            plan.touch();
            return PlanMapper.toDto(planRepository.save(plan));
        });
    }

    public Optional<PlanResponse> removeItem(Long planId, Long itemId) {
        return load(planId).map(plan -> {
            PlanItemEntity item = plan.findItem(itemId)
                .orElseThrow(() -> new BusinessException("That item is not part of this plan"));

            item.getMeal().removeItem(itemId);
            plan.touch();
            return PlanMapper.toDto(planRepository.save(plan));
        });
    }

    /** Applies a new order to a meal's items, as produced by dragging them around. */
    public Optional<PlanResponse> reorderItems(Long planId, Long mealId, List<Long> orderedItemIds) {
        return load(planId).map(plan -> {
            PlanMealEntity meal = plan.findMeal(mealId)
                .orElseThrow(() -> new BusinessException("That meal is not part of this plan"));

            if (orderedItemIds.size() != meal.getItems().size()) {
                throw new BusinessException("The new order must list every item in the meal exactly once");
            }

            for (int position = 0; position < orderedItemIds.size(); position++) {
                Long itemId = orderedItemIds.get(position);
                PlanItemEntity item = meal.getItems().stream()
                    .filter(candidate -> candidate.getId().equals(itemId))
                    .findFirst()
                    .orElseThrow(() -> new BusinessException("Item " + itemId + " is not in that meal"));
                item.setSortOrder(position);
            }

            plan.touch();
            return PlanMapper.toDto(planRepository.save(plan));
        });
    }

    /** Empties a day but keeps its meal structure, ready to be rebuilt. */
    public Optional<PlanResponse> clearDay(Long planId, int dayIndex) {
        return load(planId).map(plan -> {
            PlanDayEntity day = plan.findDay(dayIndex)
                .orElseThrow(() -> new BusinessException("That day is not part of this plan"));

            day.clearItems();
            plan.touch();
            return PlanMapper.toDto(planRepository.save(plan));
        });
    }

    /**
     * Replaces the plan's notes.
     *
     * <p>Blank is stored as null so the export's notes section stays absent rather than printing
     * an empty heading — the template branches on the field being present, not on it being
     * non-empty.
     */
    public Optional<PlanResponse> updateNotes(Long planId, String notes) {
        return load(planId).map(plan -> {
            plan.setNotes(notes == null || notes.isBlank() ? null : notes.trim());
            plan.touch();
            return PlanMapper.toDto(planRepository.save(plan));
        });
    }

    public Optional<PlanResponse> updateStatus(Long planId, String status) {
        return load(planId).map(plan -> {
            try {
                plan.setStatus(PlanStatus.valueOf(status.trim().toUpperCase()));
            } catch (IllegalArgumentException ex) {
                throw new BusinessException("Unknown plan status: " + status);
            }
            // Issuing or archiving a plan is a change to it. Without this the "last updated"
            // column stays at whenever the contents were last edited — stale at precisely the
            // moment a practitioner looks at it, which is after handing the plan to a client.
            plan.touch();
            return PlanMapper.toDto(planRepository.save(plan));
        });
    }

    public boolean delete(Long planId) {
        return load(planId).map(plan -> {
            planRepository.delete(plan);
            return true;
        }).orElse(false);
    }

    private Optional<PlanEntity> load(Long planId) {
        return planRepository.findByIdAndPractitionerId(planId, CurrentPractitioner.requireId());
    }

    private PlanDayEntity scaffoldDay(int dayIndex) {
        PlanDayEntity day = new PlanDayEntity(dayIndex);
        for (int i = 0; i < DEFAULT_MEALS.size(); i++) {
            day.addMeal(new PlanMealEntity(DEFAULT_MEALS.get(i), i));
        }
        return day;
    }

    /**
     * Picks the portion to use: the one asked for, else the food's default, else the first.
     *
     * <p>Falling back rather than failing matters — a food with no default portion is a data
     * gap, not a reason to block the practitioner mid-consultation.
     */
    private FoodPortionResponse choosePortion(FoodResponse food, Long portionId) {
        if (food.portions() == null || food.portions().isEmpty()) {
            // Nothing to fall back to, so synthesise the one unit that always makes sense.
            return new FoodPortionResponse(null, "100 γραμμάρια", new BigDecimal("100"), true);
        }

        if (portionId != null) {
            return food.portions().stream()
                .filter(portion -> portionId.equals(portion.id()))
                .findFirst()
                .orElseThrow(() -> new BusinessException("That portion does not belong to this food"));
        }

        return food.portions().stream()
            .filter(FoodPortionResponse::isDefault)
            .findFirst()
            .orElse(food.portions().get(0));
    }
}
