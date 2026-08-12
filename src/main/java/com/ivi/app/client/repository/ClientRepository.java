package com.ivi.app.client.repository;

import com.ivi.app.client.model.ClientEntity;
import com.ivi.app.shared.repository.TenantScopedRepository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

/**
 * Extends TenantScopedRepository, not JpaRepository. There is therefore no findById(id)
 * to call by accident — every lookup takes a practitionerId. ArchitectureTest enforces this
 * for all tenant-owned repositories.
 */
public interface ClientRepository extends TenantScopedRepository<ClientEntity, Long> {

    Page<ClientEntity> findAllByPractitionerIdAndFullNameContainingIgnoreCase(
        Long practitionerId, String fullName, Pageable pageable);
}
