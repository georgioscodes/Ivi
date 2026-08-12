package com.ivi.app.food.repository;

import com.ivi.app.food.model.FoodSuggestionEntity;
import com.ivi.app.food.model.SuggestionStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.repository.Repository;

import java.util.Optional;

/**
 * Suggestions are tenant-owned in the sense that a practitioner only sees their own, but they
 * are addressed to the catalogue maintainers rather than to the practitioner's own data. Every
 * read here is still scoped by practitioner.
 */
public interface FoodSuggestionRepository extends Repository<FoodSuggestionEntity, Long> {

    <S extends FoodSuggestionEntity> S save(S suggestion);

    Optional<FoodSuggestionEntity> findByIdAndPractitionerId(Long id, Long practitionerId);

    Page<FoodSuggestionEntity> findAllByPractitionerId(Long practitionerId, Pageable pageable);

    Page<FoodSuggestionEntity> findAllByPractitionerIdAndStatus(
        Long practitionerId, SuggestionStatus status, Pageable pageable);
}
