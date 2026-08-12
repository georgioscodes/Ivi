package com.ivi.app.shared.security;

import org.springframework.security.core.CredentialsContainer;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.io.Serial;
import java.io.Serializable;
import java.util.Collection;
import java.util.List;
import java.util.Objects;

/**
 * The authenticated principal, carrying the tenant id.
 *
 * <p>A mutable class rather than a record, because Spring Security needs the password hash during
 * authentication and then clears it: {@code ProviderManager} calls {@link #eraseCredentials()} on
 * success, so the principal written to the session table holds no credential material. A record
 * could not offer that.
 *
 * <p>Serializable because Spring Session writes it into Postgres. Keep the field set small and
 * stable — changing the shape invalidates every session already stored.
 */
public class AuthenticatedPractitioner implements UserDetails, CredentialsContainer, Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    private final Long practitionerId;
    private final String email;
    private final boolean enabled;

    private String passwordHash;

    public AuthenticatedPractitioner(Long practitionerId, String email, String passwordHash, boolean enabled) {
        this.practitionerId = practitionerId;
        this.email = email;
        this.passwordHash = passwordHash;
        this.enabled = enabled;
    }

    public Long practitionerId() {
        return practitionerId;
    }

    @Override
    public void eraseCredentials() {
        this.passwordHash = null;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        // Every practitioner has the same capabilities. Roles arrive when practices gain
        // assistants or multi-seat accounts; there is nothing to model yet.
        return List.of();
    }

    @Override
    public String getPassword() {
        return passwordHash;
    }

    @Override
    public String getUsername() {
        return email;
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return enabled;
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof AuthenticatedPractitioner that)) {
            return false;
        }
        return Objects.equals(practitionerId, that.practitionerId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(practitionerId);
    }

    @Override
    public String toString() {
        // Never include the hash: principals end up in logs and error reports.
        return "AuthenticatedPractitioner[id=" + practitionerId + ", email=" + email + "]";
    }
}
