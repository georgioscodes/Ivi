package com.ivi.app.export.controller;

import com.ivi.app.export.dto.PlanExport;
import com.ivi.app.export.service.PlanExportService;
import com.ivi.app.shared.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;

@RestController
@RequestMapping("/api/v1/export")
@RequiredArgsConstructor
public class PlanExportController {

    private final PlanExportService exportService;

    /**
     * The plan as a PDF.
     *
     * <p>The filename is the one the service builds from the client and plan names, encoded as
     * UTF-8 — a Greek name in a Content-Disposition header is otherwise mangled by the browser.
     * It went out as {@code plan-42.pdf} until this was wired up: a practitioner exporting for
     * three clients in a row ended up with three files they could only tell apart by opening.
     */
    @GetMapping(value = "/plan/{planId}", produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<byte[]> exportPlan(@PathVariable Long planId) {
        PlanExport export = exportService.renderPlan(planId)
            .orElseThrow(() -> new ResourceNotFoundException("Plan", planId));

        ContentDisposition disposition = ContentDisposition.attachment()
            .filename(export.fileName(), StandardCharsets.UTF_8)
            .build();

        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
            .contentType(MediaType.APPLICATION_PDF)
            .body(export.content());
    }
}
