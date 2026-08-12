package com.ivi.app.client.mapper;

import com.ivi.app.client.dto.ClientCreateRequest;
import com.ivi.app.client.dto.ClientResponse;
import com.ivi.app.client.model.ClientEntity;

import java.util.List;

public final class ClientMapper {

    private ClientMapper() {
        // Utility class — no instantiation
    }

    /**
     * The tenant id is a parameter rather than a field on the request, so it can only come
     * from the caller's session. A practitionerId arriving in a request body would be a
     * cross-tenant write waiting to happen.
     */
    public static ClientEntity toEntity(ClientCreateRequest request, Long practitionerId) {
        ClientEntity client = new ClientEntity(practitionerId, request.fullName().trim());
        client.setEmail(request.email());
        client.setPhone(request.phone());
        client.setDateOfBirth(request.dateOfBirth());
        client.setGoal(request.goal());
        client.setNotes(request.notes());
        return client;
    }

    public static ClientResponse toDto(ClientEntity client) {
        return new ClientResponse(
            client.getId(),
            client.getFullName(),
            client.getEmail(),
            client.getPhone(),
            client.getDateOfBirth(),
            client.getGoal(),
            client.getNotes(),
            client.getCreatedAt(),
            client.getUpdatedAt()
        );
    }

    public static List<ClientResponse> toDtoList(List<ClientEntity> clients) {
        return clients.stream()
            .map(ClientMapper::toDto)
            .toList();
    }
}
