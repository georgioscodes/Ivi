package com.ivi.app.measurement.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

/**
 * One recorded value for one client on one date.
 *
 * <p>Recorded as a date rather than a timestamp: a practitioner weighs someone at a visit, and
 * pretending to know the minute would imply a precision the measurement does not have.
 */
@Entity
@Table(name = "measurement")
public class MeasurementEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "practitioner_id", nullable = false, updatable = false)
    private Long practitionerId;

    @Column(name = "client_id", nullable = false, updatable = false)
    private Long clientId;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "measurement_type_id", nullable = false, updatable = false)
    private MeasurementTypeEntity type;

    @Column(nullable = false)
    private BigDecimal value;

    @Column(name = "recorded_on", nullable = false, updatable = false)
    private LocalDate recordedOn;

    private String notes;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    @Version
    private Long version;

    protected MeasurementEntity() {
        // JPA requires a no-arg constructor
    }

    public MeasurementEntity(Long practitionerId, Long clientId, MeasurementTypeEntity type,
                             BigDecimal value, LocalDate recordedOn, String notes) {
        this.practitionerId = practitionerId;
        this.clientId = clientId;
        this.type = type;
        this.value = value;
        this.recordedOn = recordedOn;
        this.notes = notes;
        this.createdAt = Instant.now();
    }

    /** Corrects an existing reading, which is what recording the same type twice in a day means. */
    public void correctTo(BigDecimal value, String notes) {
        this.value = value;
        if (notes != null) {
            this.notes = notes;
        }
        this.updatedAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public Long getPractitionerId() {
        return practitionerId;
    }

    public Long getClientId() {
        return clientId;
    }

    public MeasurementTypeEntity getType() {
        return type;
    }

    public BigDecimal getValue() {
        return value;
    }

    public LocalDate getRecordedOn() {
        return recordedOn;
    }

    public String getNotes() {
        return notes;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
