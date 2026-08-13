package com.ivi.app.journal.controller;

import com.ivi.app.journal.dto.JournalEntryCreateRequest;
import com.ivi.app.journal.dto.JournalEntryResponse;
import com.ivi.app.journal.dto.JournalEntryUpdateRequest;
import com.ivi.app.journal.service.JournalEntryService;
import com.ivi.app.shared.dto.PagedResponse;
import com.ivi.app.shared.exception.ResourceNotFoundException;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/journal")
@RequiredArgsConstructor
public class JournalEntryController {

    private final JournalEntryService journalService;

    @PostMapping
    public ResponseEntity<JournalEntryResponse> create(
            @Valid @RequestBody JournalEntryCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(journalService.create(request));
    }

    @GetMapping("/{id}")
    public ResponseEntity<JournalEntryResponse> getById(@PathVariable Long id) {
        return journalService.findById(id)
            .map(ResponseEntity::ok)
            .orElseThrow(() -> new ResourceNotFoundException("Journal entry", id));
    }

    /** A client's entries, newest first, optionally filtered by a term in the content. */
    @GetMapping
    public ResponseEntity<PagedResponse<JournalEntryResponse>> forClient(
            @RequestParam Long clientId,
            @RequestParam(required = false) String q,
            @PageableDefault(size = 20) Pageable pageable) {
        return ResponseEntity.ok(journalService.findForClient(clientId, q, pageable));
    }

    @PutMapping("/{id}")
    public ResponseEntity<JournalEntryResponse> update(
            @PathVariable Long id,
            @Valid @RequestBody JournalEntryUpdateRequest request) {
        return journalService.update(id, request)
            .map(ResponseEntity::ok)
            .orElseThrow(() -> new ResourceNotFoundException("Journal entry", id));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (!journalService.delete(id)) {
            throw new ResourceNotFoundException("Journal entry", id);
        }
        return ResponseEntity.noContent().build();
    }
}
