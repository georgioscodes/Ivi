package com.ivi.app.client.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "client")
public class ClientEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * The owning tenant. Set once at construction and never exposed by a setter — a client
     * cannot be moved between practitioners, and an accidental reassignment would be a
     * cross-tenant data leak rather than a bug in the ordinary sense.
     */
    @Column(name = "practitioner_id", nullable = false, updatable = false)
    private Long practitionerId;

    @Column(name = "full_name", nullable = false)
    private String fullName;

    // citext in the database, so lookups and uniqueness are case-insensitive without
    // every query having to remember to lower() both sides.
    @Column(columnDefinition = "citext")
    private String email;

    private String phone;

    @Column(name = "date_of_birth")
    private LocalDate dateOfBirth;

    private String goal;

    @Column(columnDefinition = "text")
    private String notes;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    @Version
    private Long version;

    protected ClientEntity() {
        // JPA requires a no-arg constructor
    }

    public ClientEntity(Long practitionerId, String fullName) {
        this.practitionerId = practitionerId;
        this.fullName = fullName;
        this.createdAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public Long getPractitionerId() {
        return practitionerId;
    }

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
        touch();
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
        touch();
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
        touch();
    }

    public LocalDate getDateOfBirth() {
        return dateOfBirth;
    }

    public void setDateOfBirth(LocalDate dateOfBirth) {
        this.dateOfBirth = dateOfBirth;
        touch();
    }

    public String getGoal() {
        return goal;
    }

    public void setGoal(String goal) {
        this.goal = goal;
        touch();
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
        touch();
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    private void touch() {
        this.updatedAt = Instant.now();
    }
}
