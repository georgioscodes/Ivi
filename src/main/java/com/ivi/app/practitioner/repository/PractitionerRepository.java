package com.ivi.app.practitioner.repository;

import com.ivi.app.practitioner.model.PractitionerEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

/**
 * The practitioner is the tenant root, not a tenant-owned entity, so this is the one
 * repository that legitimately extends JpaRepository. Everything else extends
 * TenantScopedRepository.
 */
public interface PractitionerRepository extends JpaRepository<PractitionerEntity, Long> {

    Optional<PractitionerEntity> findByEmail(String email);

    boolean existsByEmail(String email);
}
