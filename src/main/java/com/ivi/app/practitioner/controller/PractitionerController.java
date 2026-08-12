package com.ivi.app.practitioner.controller;

import com.ivi.app.practitioner.dto.PractitionerRegisterRequest;
import com.ivi.app.practitioner.dto.PractitionerResponse;
import com.ivi.app.practitioner.service.PractitionerService;
import com.ivi.app.shared.exception.ResourceNotFoundException;
import com.ivi.app.shared.security.CurrentPractitioner;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/practitioner")
@RequiredArgsConstructor
public class PractitionerController {

    private final PractitionerService practitionerService;

    @PostMapping("/registration")
    public ResponseEntity<PractitionerResponse> create(@Valid @RequestBody PractitionerRegisterRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(practitionerService.register(request));
    }

    /**
     * The current practitioner. There is deliberately no {@code /practitioner/{id}} endpoint —
     * a practitioner has no business reading another practitioner's record, so the identifier
     * comes from the session rather than from the URL.
     */
    @GetMapping("/me")
    public ResponseEntity<PractitionerResponse> getCurrent() {
        Long practitionerId = CurrentPractitioner.requireId();
        return ResponseEntity.ok(practitionerService.findById(practitionerId)
            .orElseThrow(() -> new ResourceNotFoundException("Practitioner", practitionerId)));
    }
}
