package com.ivi.app.practitioner.service;

import com.ivi.app.practitioner.dto.PractitionerRegisterRequest;
import com.ivi.app.practitioner.dto.PractitionerResponse;
import com.ivi.app.practitioner.mapper.PractitionerMapper;
import com.ivi.app.practitioner.model.PractitionerEntity;
import com.ivi.app.practitioner.repository.PractitionerRepository;
import com.ivi.app.shared.exception.BusinessException;
import lombok.RequiredArgsConstructor;

import java.nio.charset.StandardCharsets;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import java.util.Locale;

@Service
@RequiredArgsConstructor
@Transactional
public class PractitionerService {

    private final PractitionerRepository practitionerRepository;
    private final PasswordEncoder passwordEncoder;

    /**
     * BCrypt reads at most 72 bytes of a password and silently ignores the rest.
     *
     * <p>Checked in bytes rather than characters, which is the whole point: {@code @Size} counts
     * characters, and Greek is two bytes each in UTF-8, so a 72-character Greek passphrase is 144
     * bytes and half of it would never reach the hash. A practitioner choosing a long passphrase
     * for safety would get less than they typed, with nothing to tell them.
     */
    private static final int MAX_PASSWORD_BYTES = 72;

    public PractitionerResponse register(PractitionerRegisterRequest request) {
        String email = normalise(request.email());

        if (request.password().getBytes(StandardCharsets.UTF_8).length > MAX_PASSWORD_BYTES) {
            throw new BusinessException(
                "Password must be at most " + MAX_PASSWORD_BYTES + " bytes; Greek characters count as two");
        }

        if (practitionerRepository.existsByEmail(email)) {
            throw new BusinessException("An account already exists for that email address");
        }

        PractitionerEntity practitioner = new PractitionerEntity(
            email,
            passwordEncoder.encode(request.password()),
            request.displayName().trim(),
            request.practiceName() == null ? null : request.practiceName().trim()
        );

        return PractitionerMapper.toDto(practitionerRepository.save(practitioner));
    }

    @Transactional(readOnly = true)
    public Optional<PractitionerResponse> findById(Long id) {
        return practitionerRepository.findById(id)
            .map(PractitionerMapper::toDto);
    }

    private String normalise(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }
}
