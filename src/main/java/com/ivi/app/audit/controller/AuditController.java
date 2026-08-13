package com.ivi.app.audit.controller;

import com.ivi.app.audit.dto.AuditLogResponse;
import com.ivi.app.audit.service.AuditService;
import com.ivi.app.shared.dto.PagedResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/audit")
@RequiredArgsConstructor
public class AuditController {

    private final AuditService auditService;

    /**
     * The practitioner's own access trail, optionally narrowed to one client.
     *
     * <p>Exposed because they are the data controller: when a client exercises a subject access
     * request, the practitioner has to be able to answer who touched the record and when.
     */
    @GetMapping
    public ResponseEntity<PagedResponse<AuditLogResponse>> myTrail(
            @RequestParam(required = false) Long clientId,
            @PageableDefault(size = 50) Pageable pageable) {
        return ResponseEntity.ok(auditService.myTrail(clientId, pageable));
    }
}
