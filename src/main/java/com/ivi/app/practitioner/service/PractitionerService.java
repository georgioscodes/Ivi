package com.ivi.app.practitioner.service;

import com.ivi.app.practitioner.dto.PractitionerRegisterRequest;
import com.ivi.app.practitioner.dto.PractitionerResponse;
import com.ivi.app.practitioner.mapper.PractitionerMapper;
import com.ivi.app.practitioner.model.PractitionerEntity;
import com.ivi.app.practitioner.repository.PractitionerRepository;
import com.ivi.app.shared.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Service
@RequiredArgsConstructor
@Transactional
public class PractitionerService {

    private final PractitionerRepository practitionerRepository;
    private final PasswordEncoder passwordEncoder;

    public PractitionerResponse register(PractitionerRegisterRequest request) {
        String email = normalise(request.email());

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
        return email.trim().toLowerCase();
    }
}
