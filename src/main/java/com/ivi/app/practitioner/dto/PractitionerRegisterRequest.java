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
    @NotBlank(message = "Password is required")
    @Size(min = 12, max = 200, message = "Password must be between 12 and 200 characters")
    String password,

    @NotBlank(message = "Display name is required")
    @Size(max = 120, message = "Display name must be at most 120 characters")
    String displayName,

    @Size(max = 160, message = "Practice name must be at most 160 characters")
    String practiceName
) {}
