package com.ivi.app.client.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record ClientCreateRequest(

    @NotBlank(message = "Full name is required")
    @Size(max = 160, message = "Full name must be at most 160 characters")
    String fullName,

    @Email(message = "Must be a valid email address")
    @Size(max = 254, message = "Email must be at most 254 characters")
    String email,

    @Size(max = 40, message = "Phone must be at most 40 characters")
    String phone,

    @Past(message = "Date of birth must be in the past")
    LocalDate dateOfBirth,

    @Size(max = 500, message = "Goal must be at most 500 characters")
    String goal,

    String notes
) {}
