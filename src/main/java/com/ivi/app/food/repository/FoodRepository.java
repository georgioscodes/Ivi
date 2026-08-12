package com.ivi.app.food.repository;

import com.ivi.app.food.model.FoodCategory;
import com.ivi.app.food.model.FoodEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

/**
 * Food is the one table that is neither wholly global nor wholly tenant-owned, so it fits
 * neither of the usual base types.
 *
 * <p>It cannot extend {@code TenantScopedRepository}, whose {@code findByIdAndPractitionerId}
 * would never return a global row. It must not extend {@code JpaRepository}, whose unscoped
 * {@code findById} would happily hand back another practitioner's custom food. So it extends
 * the bare {@code Repository} marker and declares only queries whose scope is explicit in the
 * method name and signature.
 *
 * <p>Visibility for a practitioner is: their own foods, plus every global food they have not
 * overridden. That subtraction is what makes an override appear to <em>replace</em> the default
 * rather than sit alongside it.
 */
public interface FoodRepository extends Repository<FoodEntity, Long> {

    String VISIBLE = """
        (f.practitionerId = :practitionerId
         OR (f.practitionerId IS NULL
             AND NOT EXISTS (SELECT 1 FROM FoodEntity o
                             WHERE o.practitionerId = :practitionerId
                               AND o.overridesFoodId = f.id)))
        """;

    <S extends FoodEntity> S save(S food);

    void delete(FoodEntity food);

    @Query("SELECT f FROM FoodEntity f WHERE " + VISIBLE)
    Page<FoodEntity> findVisible(@Param("practitionerId") Long practitionerId, Pageable pageable);

    @Query("SELECT f FROM FoodEntity f WHERE f.category = :category AND " + VISIBLE)
    Page<FoodEntity> findVisibleByCategory(@Param("practitionerId") Long practitionerId,
                                           @Param("category") FoodCategory category,
                                           Pageable pageable);

    @Query("""
        SELECT f FROM FoodEntity f
        WHERE (LOWER(f.nameEl) LIKE LOWER(CONCAT('%', :term, '%'))
               OR LOWER(COALESCE(f.nameEn, '')) LIKE LOWER(CONCAT('%', :term, '%')))
          AND """ + VISIBLE)
    Page<FoodEntity> searchVisible(@Param("practitionerId") Long practitionerId,
                                   @Param("term") String term,
                                   Pageable pageable);

    /**
     * Resolves an id to what this practitioner should actually see.
     *
     * <p>Asking for a global food that the practitioner has overridden returns the override, not
     * the default — which is the whole point of overriding. At most one row can match: either the
     * override exists, in which case the {@code NOT EXISTS} clause excludes the global row, or it
     * does not.
     */
    @Query("""
        SELECT f FROM FoodEntity f
        WHERE (f.overridesFoodId = :id AND f.practitionerId = :practitionerId)
           OR (f.id = :id AND """ + VISIBLE + ")")
    Optional<FoodEntity> findVisibleById(@Param("id") Long id,
                                         @Param("practitionerId") Long practitionerId);

    /** A row from the shared catalogue. Never returns a practitioner-owned food. */
    @Query("SELECT f FROM FoodEntity f WHERE f.id = :id AND f.practitionerId IS NULL")
    Optional<FoodEntity> findGlobalById(@Param("id") Long id);

    /** A row this practitioner owns, whether a custom food or an override. */
    @Query("SELECT f FROM FoodEntity f WHERE f.id = :id AND f.practitionerId = :practitionerId")
    Optional<FoodEntity> findOwnedById(@Param("id") Long id,
                                       @Param("practitionerId") Long practitionerId);

    /** This practitioner's override of a given global food, if they have made one. */
    @Query("""
        SELECT f FROM FoodEntity f
        WHERE f.overridesFoodId = :globalFoodId AND f.practitionerId = :practitionerId
        """)
    Optional<FoodEntity> findOverride(@Param("globalFoodId") Long globalFoodId,
                                      @Param("practitionerId") Long practitionerId);
}
