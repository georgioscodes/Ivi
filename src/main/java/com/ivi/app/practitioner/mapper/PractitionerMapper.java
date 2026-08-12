package com.ivi.app.practitioner.mapper;

import com.ivi.app.practitioner.dto.PractitionerResponse;
import com.ivi.app.practitioner.model.PractitionerEntity;

public final class PractitionerMapper {

    private PractitionerMapper() {
        // Utility class — no instantiation
    }

    public static PractitionerResponse toDto(PractitionerEntity practitioner) {
        return new PractitionerResponse(
            practitioner.getId(),
            practitioner.getEmail(),
            practitioner.getDisplayName(),
            practitioner.getPracticeName(),
            practitioner.getCreatedAt()
        );
    }
}
