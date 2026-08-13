package com.ivi.app.journal.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.time.Instant;
import java.time.LocalDate;

/**
 * One consultation's notes.
 *
 * <p>The entry date is distinct from the creation timestamp: practitioners write sessions up
 * afterwards, and the date that matters clinically is when the consultation happened, not when
 * somebody found time to type it.
 */
@Entity
@Table(name = "journal_entry")
public class JournalEntryEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "practitioner_id", nullable = false, updatable = false)
    private Long practitionerId;

    @Column(name = "client_id", nullable = false, updatable = false)
    private Long clientId;

    @Column(name = "entry_date", nullable = false)
    private LocalDate entryDate;

    private String title;

    @Column(columnDefinition = "text", nullable = false)
    private String content;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    @Version
    private Long version;

    protected JournalEntryEntity() {
        // JPA requires a no-arg constructor
    }

    public JournalEntryEntity(Long practitionerId, Long clientId, LocalDate entryDate,
                              String title, String content) {
        this.practitionerId = practitionerId;
        this.clientId = clientId;
        this.entryDate = entryDate;
        this.title = title;
        this.content = content;
        this.createdAt = Instant.now();
    }

    public void amend(LocalDate entryDate, String title, String content) {
        this.entryDate = entryDate;
        this.title = title;
        this.content = content;
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

    public LocalDate getEntryDate() {
        return entryDate;
    }

    public String getTitle() {
        return title;
    }

    public String getContent() {
        return content;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
