package com.ivi.app.shared.security;

import com.ivi.app.practitioner.model.PractitionerEntity;
import com.ivi.app.practitioner.repository.PractitionerRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.Locale;

/**
 * Loads credentials for authentication.
 *
 * <p>Lives in {@code shared.security} rather than in the practitioner module because it serves the
 * framework's authentication machinery rather than the practitioner feature. It is the one place
 * outside that module allowed to touch {@code PractitionerRepository}, and it is registered as an
 * explicit exception in {@code ArchitectureTest}.
 */
@Service
@RequiredArgsConstructor
public class PractitionerUserDetailsService implements UserDetailsService {

    private final PractitionerRepository practitionerRepository;

    @Override
    @Transactional(readOnly = true)
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        PractitionerEntity practitioner = practitionerRepository.findByEmail(email.trim().toLowerCase(Locale.ROOT))
            // Generic message: distinguishing "no such account" from "wrong password" hands an
            // attacker a way to enumerate valid addresses.
            .orElseThrow(() -> new UsernameNotFoundException("Bad credentials"));

        return new AuthenticatedPractitioner(
            practitioner.getId(),
            practitioner.getEmail(),
            practitioner.getPasswordHash(),
            practitioner.isEnabled()
        );
    }
}
