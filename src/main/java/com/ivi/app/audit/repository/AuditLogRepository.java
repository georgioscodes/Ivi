package com.ivi.app.audit.repository;

import com.ivi.app.audit.model.AuditLogEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.repository.Repository;

/**
 * Append and read only: no delete, no update, deliberately. The audit trail is not
 * TenantScopedRepository-based because it has no findByIdAndPractitionerId use — entries are
 * always read as a practitioner's own list.
 */
public interface AuditLogRepository extends Repository<AuditLogEntity, Long> {

    <S extends AuditLogEntity> S save(S entry);

    Page<AuditLogEntity> findAllByPractitionerIdOrderByOccurredAtDesc(
        Long practitionerId, Pageable pageable);

    Page<AuditLogEntity> findAllByPractitionerIdAndClientIdOrderByOccurredAtDesc(
        Long practitionerId, Long clientId, Pageable pageable);
}
