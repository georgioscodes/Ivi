package com.ivi.app.nutrition.controller;

import com.ivi.app.nutrition.dto.ActivityLevelResponse;
import com.ivi.app.nutrition.dto.BmrRequest;
import com.ivi.app.nutrition.dto.BmrResponse;
import com.ivi.app.nutrition.dto.CoefficientRequirementRequest;
import com.ivi.app.nutrition.dto.EnergyRequirementRequest;
import com.ivi.app.nutrition.dto.EnergyRequirementResponse;
import com.ivi.app.nutrition.dto.MacroDistributionRequest;
import com.ivi.app.nutrition.dto.MacroDistributionResponse;
import com.ivi.app.nutrition.service.NutritionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * These endpoints compute and store nothing, so POST is used only because the inputs are
 * structured rather than because anything changes. They still require authentication: the
 * calculations are part of the paid product, not a public utility.
 */
@RestController
@RequestMapping("/api/v1/nutrition")
@RequiredArgsConstructor
public class NutritionController {

    private final NutritionService nutritionService;

    @PostMapping("/bmr")
    public ResponseEntity<BmrResponse> bmr(@Valid @RequestBody BmrRequest request) {
        return ResponseEntity.ok(nutritionService.calculateBmr(request));
    }

    @PostMapping("/energy-requirement")
    public ResponseEntity<EnergyRequirementResponse> energyRequirement(
            @Valid @RequestBody EnergyRequirementRequest request) {
        return ResponseEntity.ok(nutritionService.calculateEnergyRequirement(request));
    }

    @PostMapping("/macro-distribution")
    public ResponseEntity<MacroDistributionResponse> macroDistribution(
            @Valid @RequestBody MacroDistributionRequest request) {
        return ResponseEntity.ok(nutritionService.distributeMacros(request));
    }

    @PostMapping("/coefficient-requirement")
    public ResponseEntity<MacroDistributionResponse> coefficientRequirement(
            @Valid @RequestBody CoefficientRequirementRequest request) {
        return ResponseEntity.ok(nutritionService.calculateFromCoefficients(request));
    }

    @GetMapping("/activity-level")
    public ResponseEntity<List<ActivityLevelResponse>> activityLevels() {
        return ResponseEntity.ok(nutritionService.activityLevels());
    }
}
