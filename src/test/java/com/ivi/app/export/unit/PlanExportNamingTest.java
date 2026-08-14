package com.ivi.app.export.unit;

import com.ivi.app.audit.model.AuditAction;
import com.ivi.app.audit.service.AuditService;
import com.ivi.app.client.dto.ClientResponse;
import com.ivi.app.client.service.ClientService;
import com.ivi.app.export.dto.PlanExport;
import com.ivi.app.export.service.PlanExportService;
import com.ivi.app.export.service.PlanPdfRenderer;
import com.ivi.app.plan.dto.MacroTotals;
import com.ivi.app.plan.dto.PlanResponse;
import com.ivi.app.plan.service.PlanService;
import com.ivi.app.practitioner.service.PractitionerService;
import com.ivi.app.shared.security.AuthenticatedPractitioner;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.thymeleaf.TemplateEngine;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;

/**
 * What the exported file is called.
 *
 * <p>The service has built a name from the client and the plan since the export was written, and
 * the controller ignored it: every download arrived as {@code plan-42.pdf}. A practitioner
 * exporting for three clients in a row got three files they could only tell apart by opening
 * them, which is exactly the moment a plan for the wrong person gets attached to an email.
 *
 * <p>Nothing caught it because the export module had no tests at all. These cover the name the
 * service produces and the fact that it reaches the response.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PlanExportNamingTest {

    private static final byte[] PDF = "%PDF-1.4".getBytes();

    @Mock
    private PlanService planService;

    @Mock
    private ClientService clientService;

    @Mock
    private PractitionerService practitionerService;

    @Mock
    private TemplateEngine templateEngine;

    @Mock
    private PlanPdfRenderer renderer;

    @Mock
    private AuditService auditService;

    @InjectMocks
    private PlanExportService exportService;

    @BeforeEach
    void authenticate() {
        // The service reads the tenant from the security context and from nowhere else, so a
        // unit test has to establish one just as a request would.
        AuthenticatedPractitioner principal =
            new AuthenticatedPractitioner(7L, "dietitian@example.gr", null, true);
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities()));

        given(templateEngine.process(anyString(), any())).willReturn("<html></html>");
        given(renderer.render(anyString(), anyString())).willReturn(PDF);
        given(practitionerService.findById(any())).willReturn(Optional.empty());
    }

    @AfterEach
    void clearAuthentication() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void shouldNameTheFileAfterTheClientAndThePlan() {
        // Given — a Greek client name, which is the normal case rather than the edge one
        givenPlanFor("Μαρία Παπαδοπούλου", "Πλάνο εβδομάδας 1");

        // When
        PlanExport export = exportService.renderPlan(42L).orElseThrow();

        // Then
        assertThat(export.fileName()).isEqualTo("Μαρία Παπαδοπούλου - Πλάνο εβδομάδας 1.pdf");
        assertThat(export.content()).isEqualTo(PDF);
    }

    @Test
    void shouldReplaceCharactersAFilesystemRejects() {
        // Given — practitioners name plans freely, and a slash is an ordinary thing to type
        givenPlanFor("Γιώργος Α.", "Πλάνο 2/3 <αναθεώρηση>");

        // When
        PlanExport export = exportService.renderPlan(42L).orElseThrow();

        // Then
        assertThat(export.fileName()).isEqualTo("Γιώργος Α. - Πλάνο 2-3 -αναθεώρηση-.pdf");
    }

    @Test
    void shouldStripControlCharacters() {
        // Given — a newline reaching a Content-Disposition header is where header injection
        // starts, and both halves of this name are free text the practitioner typed
        givenPlanFor("Άννα\r\nX", "Πλάνο");

        // When
        PlanExport export = exportService.renderPlan(42L).orElseThrow();

        // Then
        assertThat(export.fileName()).doesNotContain("\r").doesNotContain("\n");
    }

    @Test
    void shouldFallBackToThePlanNameWhenTheClientCannotBeRead() {
        // Given — a plan whose client the practitioner cannot see. The export still has to be
        // named something a person can recognise.
        given(planService.findById(42L)).willReturn(Optional.of(plan("Πλάνο συντήρησης")));
        given(clientService.findById(any())).willReturn(Optional.empty());

        // When
        PlanExport export = exportService.renderPlan(42L).orElseThrow();

        // Then
        assertThat(export.fileName()).isEqualTo("Πλάνο συντήρησης - Πλάνο συντήρησης.pdf");
    }

    @Test
    void shouldRecordAnExportRatherThanARead() {
        // Given — a PDF leaves the system's control entirely, which is not the same event as
        // opening the record on screen
        givenPlanFor("Μαρία Παπαδοπούλου", "Πλάνο");

        // When
        exportService.renderPlan(42L);

        // Then
        verify(auditService).record(eq(AuditAction.EXPORT), eq("PLAN_PDF"), eq(42L), eq(3L));
    }

    @Test
    void shouldReturnEmptyForAPlanThePractitionerCannotSee() {
        // Given — findById is tenant-scoped, so this is also how a cross-tenant request looks.
        // Empty becomes a 404 at the controller, never a 403.
        given(planService.findById(42L)).willReturn(Optional.empty());

        // When
        Optional<PlanExport> export = exportService.renderPlan(42L);

        // Then
        assertThat(export).isEmpty();
    }

    private void givenPlanFor(String clientName, String planName) {
        given(planService.findById(42L)).willReturn(Optional.of(plan(planName)));
        given(clientService.findById(3L)).willReturn(Optional.of(client(clientName)));
    }

    private PlanResponse plan(String name) {
        MacroTotals zero = new MacroTotals(
            BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO);
        return new PlanResponse(42L, 3L, name, "DRAFT", zero, null, null, null,
            List.of(), zero, zero, 0L, Instant.now(), Instant.now());
    }

    private ClientResponse client(String fullName) {
        return new ClientResponse(3L, fullName, null, null, null, null, null,
            Instant.now(), Instant.now());
    }
}
