package com.ivi.app.practitioner.controller;

import com.ivi.app.practitioner.dto.LoginRequest;
import com.ivi.app.practitioner.dto.PractitionerResponse;
import com.ivi.app.practitioner.service.PractitionerService;
import com.ivi.app.shared.exception.ResourceNotFoundException;
import com.ivi.app.shared.security.AuthenticatedPractitioner;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final PractitionerService practitionerService;

    private final SecurityContextRepository securityContextRepository =
        new HttpSessionSecurityContextRepository();

    @PostMapping("/login")
    public ResponseEntity<PractitionerResponse> login(@Valid @RequestBody LoginRequest request,
                                                      HttpServletRequest httpRequest,
                                                      HttpServletResponse httpResponse) {
        Authentication authentication = authenticationManager.authenticate(
            new UsernamePasswordAuthenticationToken(request.email(), request.password()));

        // Rotate the session id before the context is stored, so a session id observed prior to
        // login cannot be replayed afterwards.
        httpRequest.getSession(true);
        httpRequest.changeSessionId();

        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        SecurityContextHolder.setContext(context);
        // Spring Security 6 does not persist a programmatically created context automatically.
        securityContextRepository.saveContext(context, httpRequest, httpResponse);

        AuthenticatedPractitioner principal = (AuthenticatedPractitioner) authentication.getPrincipal();

        return ResponseEntity.ok(practitionerService.findById(principal.practitionerId())
            .orElseThrow(() -> new ResourceNotFoundException("Practitioner", principal.practitionerId())));
    }
}
