package com.ivi.app.practitioner.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record LoginRequest(

    @NotBlank(message = "Email is required")
    // RFC 5321's maximum address length, and the width of the column the rate limiter counts
    // against. Unbounded input would otherwise reach that column and raise a data-integrity
    // error, turning a failed login into a 500.
    @Size(max = 320, message = "Email is too long")
    String email,

    @NotBlank(message = "Password is required")
    String password
) {}
