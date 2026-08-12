package com.ivi.app.food.service;

import com.ivi.app.food.dto.FoodCreateRequest;
import com.ivi.app.food.dto.FoodPortionRequest;
import com.ivi.app.food.dto.FoodResponse;
import com.ivi.app.food.dto.FoodSuggestionRequest;
import com.ivi.app.food.dto.FoodSuggestionResponse;
import com.ivi.app.food.dto.FoodUpdateRequest;
import com.ivi.app.food.mapper.FoodMapper;
import com.ivi.app.food.model.FoodCategory;
import com.ivi.app.food.model.FoodEntity;
import com.ivi.app.food.model.FoodSuggestionEntity;
import com.ivi.app.food.repository.FoodRepository;
import com.ivi.app.food.repository.FoodSuggestionRepository;
import com.ivi.app.shared.dto.PagedResponse;
import com.ivi.app.shared.exception.BusinessException;
import com.ivi.app.shared.security.CurrentPractitioner;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Transactional
public class FoodService {

    private final FoodRepository foodRepository;
    private final FoodSuggestionRepository suggestionRepository;

    @Transactional(readOnly = true)
    public PagedResponse<FoodResponse> browse(String term, String category, Pageable pageable) {
        Long practitionerId = CurrentPractitioner.requireId();

        Page<FoodEntity> page;
        if (term != null && !term.isBlank()) {
            page = foodRepository.searchVisible(practitionerId, term.trim(), pageable);
        } else if (category != null && !category.isBlank()) {
            page = foodRepository.findVisibleByCategory(practitionerId, parseCategory(category), pageable);
        } else {
            page = foodRepository.findVisible(practitionerId, pageable);
        }

        return PagedResponse.from(page.map(FoodMapper::toDto));
    }

    /**
     * Resolves an id to whatever this practitioner should see. Asking for a catalogue food they
     * have overridden returns their version, not the default.
     */
    @Transactional(readOnly = true)
    public Optional<FoodResponse> findById(Long id) {
        return foodRepository.findVisibleById(id, CurrentPractitioner.requireId())
            .map(FoodMapper::toDto);
    }

    public FoodResponse create(FoodCreateRequest request) {
        Long practitionerId = CurrentPractitioner.requireId();

        FoodEntity food = FoodEntity.custom(
            practitionerId,
            request.nameEl().trim(),
            parseCategory(request.category()),
            request.energyKcal(),
            request.proteinG(),
            request.carbohydrateG(),
            request.fatG()
        );
        food.setNameEn(request.nameEn());
        applyPortions(food, request.portions());

        return FoodMapper.toDto(foodRepository.save(food));
    }

    /**
     * One endpoint, two behaviours, decided by what is being edited rather than by the request:
     *
     * <ul>
     *   <li>a food the practitioner owns is edited in place;</li>
     *   <li>a catalogue food is <em>copied</em> into a private override, leaving the shared row
     *       untouched and every other practitioner unaffected.</li>
     * </ul>
     *
     * <p>Editing an already-overridden catalogue food updates the existing override rather than
     * creating a second one.
     */
    public Optional<FoodResponse> update(Long id, FoodUpdateRequest request) {
        Long practitionerId = CurrentPractitioner.requireId();

        Optional<FoodEntity> owned = foodRepository.findOwnedById(id, practitionerId);
        if (owned.isPresent()) {
            return owned.map(food -> applyUpdate(food, request));
        }

        Optional<FoodEntity> existingOverride = foodRepository.findOverride(id, practitionerId);
        if (existingOverride.isPresent()) {
            return existingOverride.map(food -> applyUpdate(food, request));
        }

        return foodRepository.findGlobalById(id)
            .map(global -> {
                FoodEntity override = FoodEntity.override(
                    practitionerId,
                    global,
                    request.nameEl().trim(),
                    parseCategory(request.category()),
                    request.energyKcal(),
                    request.proteinG(),
                    request.carbohydrateG(),
                    request.fatG()
                );
                override.setNameEn(request.nameEn());

                // Portions are copied from the catalogue food unless the practitioner supplied
                // their own, so overriding a value does not silently cost them their units.
                if (request.portions() == null || request.portions().isEmpty()) {
                    copyPortions(global, override);
                } else {
                    applyPortions(override, request.portions());
                }

                return FoodMapper.toDto(foodRepository.save(override));
            });
    }

    /**
     * Drops a practitioner's override so the catalogue default applies again.
     *
     * <p>Accepts either the override's own id or the id of the catalogue food it replaces, since
     * a client that has only ever seen the resolved view knows the latter.
     */
    public boolean revertOverride(Long id) {
        Long practitionerId = CurrentPractitioner.requireId();

        Optional<FoodEntity> override = foodRepository.findOverride(id, practitionerId)
            .or(() -> foodRepository.findOwnedById(id, practitionerId)
                .filter(FoodEntity::isOverride));

        return override.map(food -> {
            foodRepository.delete(food);
            return true;
        }).orElse(false);
    }

    /**
     * Deletes a food the practitioner created. Catalogue foods cannot be deleted — the way to
     * stop seeing a catalogue value is to override it.
     */
    public boolean deleteCustom(Long id) {
        Long practitionerId = CurrentPractitioner.requireId();

        return foodRepository.findOwnedById(id, practitionerId)
            .filter(food -> !food.isOverride())
            .map(food -> {
                foodRepository.delete(food);
                return true;
            })
            .orElse(false);
    }

    /**
     * Proposes a change to the shared catalogue. Independent of overriding: a practitioner may
     * want their own number immediately and the default corrected eventually, and those are
     * different requests with different audiences.
     */
    public FoodSuggestionResponse suggest(Long foodId, FoodSuggestionRequest request) {
        Long practitionerId = CurrentPractitioner.requireId();

        FoodEntity food = foodRepository.findGlobalById(foodId)
            .orElseThrow(() -> new BusinessException(
                "Suggestions apply to catalogue foods only. A food you own can be edited directly."));

        if (isEmpty(request)) {
            throw new BusinessException("A suggestion must propose at least one change");
        }

        FoodSuggestionEntity suggestion = new FoodSuggestionEntity(
            food.getId(),
            practitionerId,
            trimToNull(request.proposedNameEl()),
            request.proposedEnergyKcal(),
            request.proposedProteinG(),
            request.proposedCarbohydrateG(),
            request.proposedFatG(),
            trimToNull(request.rationale())
        );

        return FoodMapper.toDto(suggestionRepository.save(suggestion));
    }

    @Transactional(readOnly = true)
    public PagedResponse<FoodSuggestionResponse> mySuggestions(Pageable pageable) {
        Page<FoodSuggestionEntity> page =
            suggestionRepository.findAllByPractitionerId(CurrentPractitioner.requireId(), pageable);
        return PagedResponse.from(page.map(FoodMapper::toDto));
    }

    private FoodResponse applyUpdate(FoodEntity food, FoodUpdateRequest request) {
        food.setNameEl(request.nameEl().trim());
        food.setNameEn(request.nameEn());
        food.setCategory(parseCategory(request.category()));
        food.setMacros(request.energyKcal(), request.proteinG(),
            request.carbohydrateG(), request.fatG());

        if (request.portions() != null && !request.portions().isEmpty()) {
            food.getPortions().clear();
            applyPortions(food, request.portions());
        }

        return FoodMapper.toDto(foodRepository.save(food));
    }

    private void applyPortions(FoodEntity food, List<FoodPortionRequest> portions) {
        if (portions == null) {
            return;
        }
        for (int i = 0; i < portions.size(); i++) {
            food.addPortion(FoodMapper.toEntity(portions.get(i), i));
        }
    }

    private void copyPortions(FoodEntity from, FoodEntity to) {
        from.getPortions().forEach(portion -> to.addPortion(
            new com.ivi.app.food.model.FoodPortionEntity(
                portion.getLabelEl(), portion.getGrams(), portion.isDefault(), portion.getSortOrder())));
    }

    private boolean isEmpty(FoodSuggestionRequest request) {
        return trimToNull(request.proposedNameEl()) == null
            && request.proposedEnergyKcal() == null
            && request.proposedProteinG() == null
            && request.proposedCarbohydrateG() == null
            && request.proposedFatG() == null;
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private FoodCategory parseCategory(String category) {
        try {
            return FoodCategory.valueOf(category.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new BusinessException("Unknown food category: " + category);
        }
    }
}
