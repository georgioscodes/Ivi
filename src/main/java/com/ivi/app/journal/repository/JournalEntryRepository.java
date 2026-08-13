package com.ivi.app.journal.repository;

import com.ivi.app.journal.model.JournalEntryEntity;
import com.ivi.app.shared.repository.TenantScopedRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

/**
 * Journal entries are tenant-owned, so this extends TenantScopedRepository and gets no
 * unscoped finder.
 */
public interface JournalEntryRepository extends TenantScopedRepository<JournalEntryEntity, Long> {

    Page<JournalEntryEntity> findAllByPractitionerIdAndClientIdOrderByEntryDateDesc(
        Long practitionerId, Long clientId, Pageable pageable);

    Page<JournalEntryEntity> findAllByPractitionerIdAndClientIdAndContentContainingIgnoreCaseOrderByEntryDateDesc(
        Long practitionerId, Long clientId, String term, Pageable pageable);
}
