package com.ivi.app.plan.repository;

import com.ivi.app.plan.model.PlanEntity;
import com.ivi.app.shared.repository.TenantScopedRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

/**
 * Plans are tenant-owned, so this extends TenantScopedRepository and gets no unscoped finder.
 */
public interface PlanRepository extends TenantScopedRepository<PlanEntity, Long> {

    Page<PlanEntity> findAllByPractitionerIdAndClientId(
        Long practitionerId, Long clientId, Pageable pageable);
}
