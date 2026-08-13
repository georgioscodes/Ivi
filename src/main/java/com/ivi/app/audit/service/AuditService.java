package com.ivi.app.audit.service;

import com.ivi.app.audit.dto.AuditLogResponse;
import com.ivi.app.audit.mapper.AuditLogMapper;
import com.ivi.app.audit.model.AuditAction;
import com.ivi.app.audit.model.AuditLogEntity;
import com.ivi.app.audit.repository.AuditLogRepository;
import com.ivi.app.shared.dto.PagedResponse;
import com.ivi.app.shared.security.CurrentPractitioner;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuditService {

    private final AuditLogRepository auditRepository;

    /**
     * Records an access.
     *
     * <p>Runs in its own transaction so the trail survives a rollback of the operation it
     * describes: an attempt that failed is still an attempt somebody made.
     *
     * <p>Never throws. An audit write that fails must not take down the request that triggered
     * it — but it is logged at error level, because silently losing the trail is its own problem.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(AuditAction action, String entityType, Long entityId, Long clientId) {
        try {
            auditRepository.save(new AuditLogEntity(
                CurrentPractitioner.requireId(),
                clientId,
                action,
                entityType,
                entityId,
                MDC.get("correlationId"),
                callerIp()
            ));
        } catch (RuntimeException ex) {
            log.error("Could not write audit entry for {} {} {}", action, entityType, entityId, ex);
        }
    }

    /** Convenience for the common case: reading something belonging to a client. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordClientRead(String entityType, Long entityId, Long clientId) {
        record(AuditAction.READ, entityType, entityId, clientId);
    }

    /**
     * The practitioner's own trail. Scoped to them: an audit log that one tenant could read
     * across others would be a disclosure rather than a control.
     */
    @Transactional(readOnly = true)
    public PagedResponse<AuditLogResponse> myTrail(Long clientId, Pageable pageable) {
        Long practitionerId = CurrentPractitioner.requireId();

        Page<AuditLogEntity> page = clientId == null
            ? auditRepository.findAllByPractitionerIdOrderByOccurredAtDesc(practitionerId, pageable)
            : auditRepository.findAllByPractitionerIdAndClientIdOrderByOccurredAtDesc(
                practitionerId, clientId, pageable);

        return PagedResponse.from(page.map(AuditLogMapper::toDto));
    }

    private String callerIp() {
        if (RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attributes) {
            HttpServletRequest request = attributes.getRequest();
            // Behind the load balancer the socket address is the proxy, so the forwarded header
            // is the useful value. Only the first entry is the client; the rest are hops.
            String forwarded = request.getHeader("X-Forwarded-For");
            if (forwarded != null && !forwarded.isBlank()) {
                return forwarded.split(",")[0].trim();
            }
            return request.getRemoteAddr();
        }
        return null;
    }
}
