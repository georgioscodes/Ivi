package com.ivi.app.journal.service;

import com.ivi.app.audit.service.AuditService;
import com.ivi.app.client.service.ClientService;
import com.ivi.app.journal.dto.JournalEntryCreateRequest;
import com.ivi.app.journal.dto.JournalEntryResponse;
import com.ivi.app.journal.dto.JournalEntryUpdateRequest;
import com.ivi.app.journal.mapper.JournalEntryMapper;
import com.ivi.app.journal.model.JournalEntryEntity;
import com.ivi.app.journal.repository.JournalEntryRepository;
import com.ivi.app.shared.dto.PagedResponse;
import com.ivi.app.shared.exception.BusinessException;
import com.ivi.app.shared.security.CurrentPractitioner;
import com.ivi.app.shared.util.GreekText;
import com.ivi.app.shared.util.LikeTerm;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Transactional
public class JournalEntryService {

    private final JournalEntryRepository journalRepository;
    private final ClientService clientService;
    private final AuditService auditService;

    public JournalEntryResponse create(JournalEntryCreateRequest request) {
        Long practitionerId = CurrentPractitioner.requireId();
        requireOwnClient(request.clientId());

        JournalEntryEntity entry = new JournalEntryEntity(
            practitionerId,
            request.clientId(),
            request.entryDate() == null ? LocalDate.now() : request.entryDate(),
            trimToNull(request.title()),
            request.content().trim()
        );

        return JournalEntryMapper.toDto(journalRepository.save(entry));
    }

    @Transactional(readOnly = true)
    public Optional<JournalEntryResponse> findById(Long id) {
        Optional<JournalEntryResponse> entry = journalRepository
            .findByIdAndPractitionerId(id, CurrentPractitioner.requireId())
            .map(JournalEntryMapper::toDto);
        entry.ifPresent(found ->
            auditService.recordClientRead("JOURNAL_ENTRY", found.id(), found.clientId()));
        return entry;
    }

    @Transactional(readOnly = true)
    public PagedResponse<JournalEntryResponse> findForClient(Long clientId, String term, Pageable pageable) {
        Long practitionerId = CurrentPractitioner.requireId();
        requireOwnClient(clientId);

        auditService.recordClientRead("JOURNAL", null, clientId);

        // The term is folded here and the stored text is folded in the query, so a word typed with
        // its accent finds the same word written in capitals — which is how Greek headings are
        // written, and so how half the entries read.
        Page<JournalEntryEntity> page = (term == null || term.isBlank())
            ? journalRepository.findForClient(practitionerId, clientId, pageable)
            : journalRepository.search(
                practitionerId, clientId,
                LikeTerm.escape(GreekText.fold(term.trim())), pageable);

        return PagedResponse.from(page.map(JournalEntryMapper::toDto));
    }

    public Optional<JournalEntryResponse> update(Long id, JournalEntryUpdateRequest request) {
        return journalRepository.findByIdAndPractitionerId(id, CurrentPractitioner.requireId())
            .map(entry -> {
                entry.amend(
                    request.entryDate() == null ? entry.getEntryDate() : request.entryDate(),
                    trimToNull(request.title()),
                    request.content().trim());
                return JournalEntryMapper.toDto(journalRepository.save(entry));
            });
    }

    public boolean delete(Long id) {
        return journalRepository.findByIdAndPractitionerId(id, CurrentPractitioner.requireId())
            .map(entry -> {
                journalRepository.delete(entry);
                return true;
            })
            .orElse(false);
    }

    /** Confirms the client belongs to the caller, through the client module's own scoping. */
    private void requireOwnClient(Long clientId) {
        clientService.findById(clientId)
            .orElseThrow(() -> new BusinessException("No such client"));
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
