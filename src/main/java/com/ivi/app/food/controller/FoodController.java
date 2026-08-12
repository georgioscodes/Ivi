package com.ivi.app.food.controller;

import com.ivi.app.food.dto.FoodCreateRequest;
import com.ivi.app.food.dto.FoodResponse;
import com.ivi.app.food.dto.FoodSuggestionRequest;
import com.ivi.app.food.dto.FoodSuggestionResponse;
import com.ivi.app.food.dto.FoodUpdateRequest;
import com.ivi.app.food.service.FoodService;
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
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/food")
@RequiredArgsConstructor
public class FoodController {

    private final FoodService foodService;

    /**
     * The practitioner's effective catalogue: their own foods plus every catalogue food they
     * have not overridden. An overridden food appears once, with their values.
     */
    @GetMapping
    public ResponseEntity<PagedResponse<FoodResponse>> getAll(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String category,
            @PageableDefault(size = 20, sort = "nameEl", direction = Sort.Direction.ASC)
            Pageable pageable) {

        return ResponseEntity.ok(foodService.browse(q, category, pageable));
    }

    @GetMapping("/{id}")
    public ResponseEntity<FoodResponse> getById(@PathVariable Long id) {
        return foodService.findById(id)
            .map(ResponseEntity::ok)
            .orElseThrow(() -> new ResourceNotFoundException("Food", id));
    }

    @PostMapping
    public ResponseEntity<FoodResponse> create(@Valid @RequestBody FoodCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(foodService.create(request));
    }

    /**
     * Edits an owned food in place, or creates a private override of a catalogue food.
     * The shared catalogue is never modified through this endpoint.
     */
    @PutMapping("/{id}")
    public ResponseEntity<FoodResponse> update(@PathVariable Long id,
                                               @Valid @RequestBody FoodUpdateRequest request) {
        return foodService.update(id, request)
            .map(ResponseEntity::ok)
            .orElseThrow(() -> new ResourceNotFoundException("Food", id));
    }

    /** Drops the practitioner's override so the catalogue default applies again. */
    @DeleteMapping("/{id}/override")
    public ResponseEntity<Void> revertOverride(@PathVariable Long id) {
        if (!foodService.revertOverride(id)) {
            throw new ResourceNotFoundException("Food override", id);
        }
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (!foodService.deleteCustom(id)) {
            throw new ResourceNotFoundException("Food", id);
        }
        return ResponseEntity.noContent().build();
    }

    /** Proposes a change to the shared catalogue, for review. Changes nothing immediately. */
    @PostMapping("/{id}/suggestion")
    public ResponseEntity<FoodSuggestionResponse> suggest(
            @PathVariable Long id,
            @Valid @RequestBody FoodSuggestionRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(foodService.suggest(id, request));
    }

    @GetMapping("/suggestion")
    public ResponseEntity<PagedResponse<FoodSuggestionResponse>> mySuggestions(
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC)
            Pageable pageable) {
        return ResponseEntity.ok(foodService.mySuggestions(pageable));
    }
}
