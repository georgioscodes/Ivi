package com.ivi.app.food.mapper;

import com.ivi.app.food.dto.FoodPortionRequest;
import com.ivi.app.food.dto.FoodPortionResponse;
import com.ivi.app.food.dto.FoodResponse;
import com.ivi.app.food.dto.FoodSuggestionResponse;
import com.ivi.app.food.model.FoodEntity;
import com.ivi.app.food.model.FoodPortionEntity;
import com.ivi.app.food.model.FoodSuggestionEntity;

import java.util.List;

public final class FoodMapper {

    private FoodMapper() {
        // Utility class — no instantiation
    }

    public static FoodResponse toDto(FoodEntity food) {
        return new FoodResponse(
            food.getId(),
            food.getNameEl(),
            food.getNameEn(),
            food.getCategory().name(),
            food.getEnergyKcal(),
            food.getProteinG(),
            food.getCarbohydrateG(),
            food.getFatG(),
            food.getSource().name(),
            toPortionDtoList(food.getPortions()),
            food.isGlobal(),
            food.isOverride(),
            food.getOverridesFoodId()
        );
    }

    public static FoodPortionResponse toDto(FoodPortionEntity portion) {
        return new FoodPortionResponse(
            portion.getId(),
            portion.getLabelEl(),
            portion.getGrams(),
            portion.isDefault()
        );
    }

    public static List<FoodPortionResponse> toPortionDtoList(List<FoodPortionEntity> portions) {
        return portions.stream()
            .map(FoodMapper::toDto)
            .toList();
    }

    public static FoodPortionEntity toEntity(FoodPortionRequest request, int sortOrder) {
        return new FoodPortionEntity(
            request.label().trim(),
            request.grams(),
            request.isDefault(),
            sortOrder
        );
    }

    public static FoodSuggestionResponse toDto(FoodSuggestionEntity suggestion) {
        return new FoodSuggestionResponse(
            suggestion.getId(),
            suggestion.getFoodId(),
            suggestion.getProposedNameEl(),
            suggestion.getProposedEnergyKcal(),
            suggestion.getProposedProteinG(),
            suggestion.getProposedCarbohydrateG(),
            suggestion.getProposedFatG(),
            suggestion.getRationale(),
            suggestion.getStatus().name(),
            suggestion.getCreatedAt(),
            suggestion.getReviewedAt()
        );
    }
}
