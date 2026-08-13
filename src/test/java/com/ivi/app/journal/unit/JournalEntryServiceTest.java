package com.ivi.app.journal.unit;

import com.ivi.app.audit.service.AuditService;
import com.ivi.app.client.dto.ClientResponse;
import com.ivi.app.client.service.ClientService;
import com.ivi.app.journal.dto.JournalEntryCreateRequest;
import com.ivi.app.journal.dto.JournalEntryResponse;
import com.ivi.app.journal.dto.JournalEntryUpdateRequest;
import com.ivi.app.journal.model.JournalEntryEntity;
import com.ivi.app.journal.repository.JournalEntryRepository;
import com.ivi.app.journal.service.JournalEntryService;
import com.ivi.app.shared.exception.BusinessException;
import com.ivi.app.shared.security.AuthenticatedPractitioner;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.mockito.Mockito.never;

@ExtendWith(MockitoExtension.class)
class JournalEntryServiceTest {

    private static final Long PRACTITIONER_ID = 5L;
    private static final Long CLIENT_ID = 11L;

    @Mock
    private JournalEntryRepository journalRepository;

    @Mock
    private ClientService clientService;

    @Mock
    private AuditService auditService;

    private JournalEntryService journalService;

    @BeforeEach
    void setUp() {
        journalService = new JournalEntryService(journalRepository, clientService, auditService);
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(
                new AuthenticatedPractitioner(PRACTITIONER_ID, "j@example.gr", null, true),
                null, List.of()));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void shouldDateTheEntryToday_whenNoDateIsGiven() {
        // Given — the common case: written at the end of a consultation
        givenClientExists();
        given(journalRepository.save(any(JournalEntryEntity.class)))
            .willAnswer(invocation -> invocation.getArgument(0));

        // When
        journalService.create(new JournalEntryCreateRequest(CLIENT_ID, null, null, "Σημειώσεις"));

        // Then
        ArgumentCaptor<JournalEntryEntity> captor = ArgumentCaptor.forClass(JournalEntryEntity.class);
        then(journalRepository).should().save(captor.capture());
        assertThat(captor.getValue().getEntryDate()).isEqualTo(LocalDate.now());
    }

    @Test
    void shouldKeepTheGivenDate_whenASessionIsWrittenUpLater() {
        // Given — the consultation happened last month
        givenClientExists();
        given(journalRepository.save(any(JournalEntryEntity.class)))
            .willAnswer(invocation -> invocation.getArgument(0));
        LocalDate consultation = LocalDate.now().minusMonths(1);

        // When
        JournalEntryResponse response = journalService.create(
            new JournalEntryCreateRequest(CLIENT_ID, consultation, "Πρώτη", "Ιστορικό"));

        // Then — the clinically relevant date is when it happened, not when it was typed
        assertThat(response.entryDate()).isEqualTo(consultation);
    }

    @Test
    void shouldStoreABlankTitleAsNull_ratherThanAsWhitespace() {
        // Given
        givenClientExists();
        given(journalRepository.save(any(JournalEntryEntity.class)))
            .willAnswer(invocation -> invocation.getArgument(0));

        // When
        JournalEntryResponse response = journalService.create(
            new JournalEntryCreateRequest(CLIENT_ID, null, "   ", "Σημειώσεις"));

        // Then
        assertThat(response.title()).isNull();
    }

    @Test
    void shouldRefuse_whenTheClientBelongsToAnotherPractitioner() {
        // Given — the client module resolves nothing, because it scopes by tenant
        given(clientService.findById(CLIENT_ID)).willReturn(Optional.empty());

        JournalEntryCreateRequest request =
            new JournalEntryCreateRequest(CLIENT_ID, null, null, "Σημειώσεις");

        // When / Then
        assertThatThrownBy(() -> journalService.create(request))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("No such client");

        then(journalRepository).should(never()).save(any());
    }

    @Test
    void shouldKeepTheExistingDate_whenAnAmendmentOmitsIt() {
        // Given
        LocalDate original = LocalDate.now().minusWeeks(2);
        JournalEntryEntity entry = new JournalEntryEntity(
            PRACTITIONER_ID, CLIENT_ID, original, "Αρχικός", "Αρχικό περιεχόμενο");

        given(journalRepository.findByIdAndPractitionerId(1L, PRACTITIONER_ID))
            .willReturn(Optional.of(entry));
        given(journalRepository.save(any(JournalEntryEntity.class)))
            .willAnswer(invocation -> invocation.getArgument(0));

        // When — correcting the text without restating the date
        Optional<JournalEntryResponse> response = journalService.update(
            1L, new JournalEntryUpdateRequest(null, "Νέος", "Νέο περιεχόμενο"));

        // Then — the consultation date is not silently moved to today
        assertThat(response).isPresent();
        assertThat(response.get().entryDate()).isEqualTo(original);
        assertThat(response.get().content()).isEqualTo("Νέο περιεχόμενο");
    }

    @Test
    void shouldReturnEmpty_whenAmendingAnotherPractitionersEntry() {
        // Given
        given(journalRepository.findByIdAndPractitionerId(1L, PRACTITIONER_ID))
            .willReturn(Optional.empty());

        // When
        Optional<JournalEntryResponse> response = journalService.update(
            1L, new JournalEntryUpdateRequest(null, "Νέος", "Νέο"));

        // Then — the controller turns this into a 404, never a 403
        assertThat(response).isEmpty();
        then(journalRepository).should(never()).save(any());
    }

    private void givenClientExists() {
        given(clientService.findById(CLIENT_ID)).willReturn(Optional.of(
            new ClientResponse(CLIENT_ID, "Ελένη", null, null, null, null, null, null, null)));
    }
}
