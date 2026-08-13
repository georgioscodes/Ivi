package com.ivi.app.plan.controller;

import com.ivi.app.plan.dto.PlanCreateRequest;
import com.ivi.app.plan.dto.PlanItemAddRequest;
import com.ivi.app.plan.dto.PlanItemUpdateRequest;
import com.ivi.app.plan.dto.PlanResponse;
import com.ivi.app.plan.dto.PlanSummaryResponse;
import com.ivi.app.plan.service.PlanService;
import com.ivi.app.shared.dto.PagedResponse;
import com.ivi.app.shared.exception.ResourceNotFoundException;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/plan")
@RequiredArgsConstructor
public class PlanController {

    private final PlanService planService;

    @PostMapping
    public ResponseEntity<PlanResponse> create(@Valid @RequestBody PlanCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(planService.create(request));
    }

    @GetMapping("/{id}")
    public ResponseEntity<PlanResponse> getById(@PathVariable Long id) {
        return planService.findById(id)
            .map(ResponseEntity::ok)
            .orElseThrow(() -> new ResourceNotFoundException("Plan", id));
    }

    @GetMapping
    public ResponseEntity<PagedResponse<PlanSummaryResponse>> getAll(
            @RequestParam(required = false) Long clientId,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC)
            Pageable pageable) {

        return ResponseEntity.ok(clientId == null
            ? planService.findAll(pageable)
            : planService.findByClient(clientId, pageable));
    }

    /**
     * Mutations return the whole plan rather than the changed item.
     *
     * <p>Adding one food changes that meal's totals, the day's totals, the day's progress against
     * target and the plan's daily average. Returning only the item would leave the client
     * recomputing all of it and risking a different answer from the server's.
     */
    @PostMapping("/{planId}/meal/{mealId}/item")
    public ResponseEntity<PlanResponse> addItem(@PathVariable Long planId,
                                                @PathVariable Long mealId,
                                                @Valid @RequestBody PlanItemAddRequest request) {
        return planService.addItem(planId, mealId, request)
            .map(ResponseEntity::ok)
            .orElseThrow(() -> new ResourceNotFoundException("Plan", planId));
    }

    @PutMapping("/{planId}/item/{itemId}")
    public ResponseEntity<PlanResponse> updateItem(@PathVariable Long planId,
                                                   @PathVariable Long itemId,
                                                   @Valid @RequestBody PlanItemUpdateRequest request) {
        return planService.updateItem(planId, itemId, request)
            .map(ResponseEntity::ok)
            .orElseThrow(() -> new ResourceNotFoundException("Plan", planId));
    }

    @DeleteMapping("/{planId}/item/{itemId}")
    public ResponseEntity<PlanResponse> removeItem(@PathVariable Long planId,
                                                   @PathVariable Long itemId) {
        return planService.removeItem(planId, itemId)
            .map(ResponseEntity::ok)
            .orElseThrow(() -> new ResourceNotFoundException("Plan", planId));
    }

    @PutMapping("/{planId}/meal/{mealId}/order")
    public ResponseEntity<PlanResponse> reorderItems(@PathVariable Long planId,
                                                     @PathVariable Long mealId,
                                                     @RequestBody List<Long> orderedItemIds) {
        return planService.reorderItems(planId, mealId, orderedItemIds)
            .map(ResponseEntity::ok)
            .orElseThrow(() -> new ResourceNotFoundException("Plan", planId));
    }

    @DeleteMapping("/{planId}/day/{dayIndex}/item")
    public ResponseEntity<PlanResponse> clearDay(@PathVariable Long planId,
                                                 @PathVariable int dayIndex) {
        return planService.clearDay(planId, dayIndex)
            .map(ResponseEntity::ok)
            .orElseThrow(() -> new ResourceNotFoundException("Plan", planId));
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<PlanResponse> updateStatus(@PathVariable Long id,
                                                     @RequestBody Map<String, String> body) {
        return planService.updateStatus(id, body.getOrDefault("status", ""))
            .map(ResponseEntity::ok)
            .orElseThrow(() -> new ResourceNotFoundException("Plan", id));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (!planService.delete(id)) {
            throw new ResourceNotFoundException("Plan", id);
        }
        return ResponseEntity.noContent().build();
    }
}
