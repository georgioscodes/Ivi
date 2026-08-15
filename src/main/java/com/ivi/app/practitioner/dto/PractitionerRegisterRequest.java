package com.ivi.app.practitioner.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record PractitionerRegisterRequest(

    @NotBlank(message = "Email is required")
    @Email(message = "Must be a valid email address")
    @Size(max = 254, message = "Email must be at most 254 characters")
    String email,

    // Length over complexity, per NIST SP 800-63B. Composition rules push users towards
    // predictable substitutions without materially raising the cost of guessing.
    /*
     * 72 rather than 200, because that is where BCrypt stops reading. Anything beyond the 72nd
     * *byte* is silently discarded when the hash is computed, so a longer passphrase is not the
     * extra security it looks like — and in Greek it bites twice as fast, since each character is
     * two bytes in UTF-8: a 100-character Greek passphrase was being hashed from its first 36
     * characters. Rejecting what cannot be honoured is better than accepting it and quietly
     * hashing a prefix.
     */
    @NotBlank(message = "Password is required")
    @Size(min = 12, max = 72, message = "Password must be between 12 and 72 characters")
    String password,

    @NotBlank(message = "Display name is required")
    @Size(max = 120, message = "Display name must be at most 120 characters")
    String displayName,

    @Size(max = 160, message = "Practice name must be at most 160 characters")
    String practiceName
) {}
