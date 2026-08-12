package com.ivi.app.practitioner.unit;

import com.ivi.app.practitioner.dto.PractitionerRegisterRequest;
import com.ivi.app.practitioner.dto.PractitionerResponse;
import com.ivi.app.practitioner.model.PractitionerEntity;
import com.ivi.app.practitioner.repository.PractitionerRepository;
import com.ivi.app.practitioner.service.PractitionerService;
import com.ivi.app.shared.exception.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.mockito.Mockito.never;

@ExtendWith(MockitoExtension.class)
class PractitionerServiceTest {

    @Mock
    private PractitionerRepository practitionerRepository;

    private PractitionerService practitionerService;

    @BeforeEach
    void setUp() {
        // A real encoder, at low cost for test speed. The hashing behaviour is part of what
        // these tests assert, so it is not mocked.
        practitionerService = new PractitionerService(practitionerRepository, new BCryptPasswordEncoder(4));
    }

    @Test
    void shouldStoreTheEmailLowercased_whenRegistering() {
        // Given
        given(practitionerRepository.existsByEmail("vasilis@example.gr")).willReturn(false);
        given(practitionerRepository.save(any(PractitionerEntity.class)))
            .willAnswer(invocation -> invocation.getArgument(0));

        PractitionerRegisterRequest request = new PractitionerRegisterRequest(
            "  Vasilis@Example.GR  ", "a-sufficiently-long-password", "Vasilis", "Practice");

        // When
        practitionerService.register(request);

        // Then
        ArgumentCaptor<PractitionerEntity> captor = ArgumentCaptor.forClass(PractitionerEntity.class);
        then(practitionerRepository).should().save(captor.capture());
        assertThat(captor.getValue().getEmail()).isEqualTo("vasilis@example.gr");
    }

    @Test
    void shouldNeverStoreThePasswordInClear_whenRegistering() {
        // Given
        String password = "a-sufficiently-long-password";
        given(practitionerRepository.existsByEmail(any())).willReturn(false);
        given(practitionerRepository.save(any(PractitionerEntity.class)))
            .willAnswer(invocation -> invocation.getArgument(0));

        // When
        practitionerService.register(new PractitionerRegisterRequest(
            "vasilis@example.gr", password, "Vasilis", null));

        // Then
        ArgumentCaptor<PractitionerEntity> captor = ArgumentCaptor.forClass(PractitionerEntity.class);
        then(practitionerRepository).should().save(captor.capture());
        assertThat(captor.getValue().getPasswordHash())
            .isNotEqualTo(password)
            .startsWith("$2");
    }

    @Test
    void shouldRejectRegistration_whenTheEmailIsAlreadyTaken() {
        // Given
        given(practitionerRepository.existsByEmail("taken@example.gr")).willReturn(true);

        PractitionerRegisterRequest request = new PractitionerRegisterRequest(
            "taken@example.gr", "a-sufficiently-long-password", "Someone", null);

        // When / Then
        assertThatThrownBy(() -> practitionerService.register(request))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("already exists");

        then(practitionerRepository).should(never()).save(any());
    }

    @Test
    void shouldNotExposeThePasswordHash_whenReturningAResponse() {
        // Given
        given(practitionerRepository.existsByEmail(any())).willReturn(false);
        given(practitionerRepository.save(any(PractitionerEntity.class)))
            .willAnswer(invocation -> invocation.getArgument(0));

        // When
        PractitionerResponse response = practitionerService.register(new PractitionerRegisterRequest(
            "vasilis@example.gr", "a-sufficiently-long-password", "Vasilis", null));

        // Then — the response record has no field capable of carrying it
        assertThat(response.email()).isEqualTo("vasilis@example.gr");
        assertThat(response.toString()).doesNotContain("$2");
    }
}
