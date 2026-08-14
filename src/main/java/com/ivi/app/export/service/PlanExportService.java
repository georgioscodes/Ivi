package com.ivi.app.export.service;

import com.ivi.app.audit.model.AuditAction;
import com.ivi.app.audit.service.AuditService;
import com.ivi.app.client.dto.ClientResponse;
import com.ivi.app.export.dto.PlanExport;
import com.ivi.app.client.service.ClientService;
import com.ivi.app.plan.dto.PlanResponse;
import com.ivi.app.plan.service.PlanService;
import com.ivi.app.practitioner.dto.PractitionerResponse;
import com.ivi.app.practitioner.service.PractitionerService;
import com.ivi.app.shared.security.CurrentPractitioner;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/**
 * Renders a plan as the document a client actually receives.
 *
 * <p>Reaches plans, clients and practitioners through their services, so the export module owns
 * only presentation. Greek labels live here rather than in the template so they can be varied
 * per print template when Phase 1 makes the layout configurable.
 */
@Service
@RequiredArgsConstructor
public class PlanExportService {

    private static final Locale GREEK = Locale.forLanguageTag("el-GR");
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("d MMMM yyyy", GREEK);

    /** Day 0 is Monday when a plan is a literal week. */
    private static final String[] DAY_NAMES = {
        "Δευτέρα", "Τρίτη", "Τετάρτη", "Πέμπτη", "Παρασκευή", "Σάββατο", "Κυριακή"
    };

    private static final Map<String, String> MEAL_LABELS = Map.of(
        "BREAKFAST", "Πρωινό",
        "MORNING_SNACK", "Δεκατιανό",
        "LUNCH", "Μεσημεριανό",
        "AFTERNOON_SNACK", "Απογευματινό",
        "DINNER", "Βραδινό",
        "EVENING_SNACK", "Προ ύπνου"
    );

    private final PlanService planService;
    private final ClientService clientService;
    private final PractitionerService practitionerService;
    private final TemplateEngine templateEngine;
    private final PlanPdfRenderer renderer;
    private final AuditService auditService;

    @Transactional(readOnly = true)
    public Optional<PlanExport> renderPlan(Long planId) {
        return planService.findById(planId).map(plan -> {
            String clientName = clientService.findById(plan.clientId())
                .map(ClientResponse::fullName)
                .orElse("");

            String practiceName = practitionerService.findById(CurrentPractitioner.requireId())
                .map(this::practiceNameOf)
                .orElse("");

            // EXPORT rather than READ: a downloaded PDF leaves the system's control entirely,
            // which is a materially different event from viewing a record on screen.
            auditService.record(AuditAction.EXPORT, "PLAN_PDF", plan.id(), plan.clientId());

            byte[] pdf = renderer.render(
                buildHtml(plan, clientName, practiceName), "classpath:/templates/");

            return new PlanExport(pdf, fileNameFor(plan, clientName));
        });
    }

    /**
     * A filename the practitioner can find later.
     *
     * <p>Non-ASCII is kept — the Content-Disposition header encodes it — but characters that are
     * awkward in a filename are replaced rather than left to the operating system to reject.
     * Control characters go too: both halves of the name are practitioner-entered free text, and
     * a newline reaching a response header is how header injection starts.
     */
    String fileNameFor(PlanResponse plan, String clientName) {
        String base = (clientName == null || clientName.isBlank() ? plan.name() : clientName)
            + " - " + plan.name();
        return base.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "-").trim() + ".pdf";
    }

    private String buildHtml(PlanResponse plan, String clientName, String practiceName) {
        Context context = new Context(GREEK);
        context.setVariable("plan", plan);
        context.setVariable("clientName", clientName);
        context.setVariable("practiceName", practiceName);
        context.setVariable("issuedOn", LocalDate.now().format(DATE));
        context.setVariable("dayLabels", dayLabels(plan));
        context.setVariable("mealLabels", MEAL_LABELS);

        // Fixed for now. Phase 1 turns these into per-practitioner print templates, which is why
        // the template already branches on them rather than hardcoding the sections.
        context.setVariable("showAnalysis", true);
        context.setVariable("showQuantities", true);

        return templateEngine.process("export/plan", context);
    }

    /**
     * Day headings: a practitioner's own label if they set one, otherwise a weekday name, and
     * beyond seven days a plain numbered heading rather than a second Monday.
     */
    private Map<Integer, String> dayLabels(PlanResponse plan) {
        Map<Integer, String> labels = new LinkedHashMap<>();
        plan.days().forEach(day -> {
            String label = day.label() != null && !day.label().isBlank()
                ? day.label()
                : (day.dayIndex() < DAY_NAMES.length
                    ? DAY_NAMES[day.dayIndex()]
                    : "Ημέρα " + (day.dayIndex() + 1));
            labels.put(day.dayIndex(), label);
        });
        return labels;
    }

    private String practiceNameOf(PractitionerResponse practitioner) {
        return practitioner.practiceName() == null || practitioner.practiceName().isBlank()
            ? practitioner.displayName()
            : practitioner.practiceName();
    }
}
