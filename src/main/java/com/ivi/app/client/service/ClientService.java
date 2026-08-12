package com.ivi.app.client.service;

import com.ivi.app.client.dto.ClientCreateRequest;
import com.ivi.app.client.dto.ClientResponse;
import com.ivi.app.client.dto.ClientUpdateRequest;
import com.ivi.app.client.mapper.ClientMapper;
import com.ivi.app.client.model.ClientEntity;
import com.ivi.app.client.repository.ClientRepository;
import com.ivi.app.shared.dto.PagedResponse;
import com.ivi.app.shared.security.CurrentPractitioner;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

/**
 * Every method here resolves the tenant from the security context and passes it to the
 * repository. No method accepts a practitioner id from its caller, so a controller cannot
 * pass one through from a request.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class ClientService {

    private final ClientRepository clientRepository;

    public ClientResponse create(ClientCreateRequest request) {
        Long practitionerId = CurrentPractitioner.requireId();
        ClientEntity client = ClientMapper.toEntity(request, practitionerId);
        return ClientMapper.toDto(clientRepository.save(client));
    }

    @Transactional(readOnly = true)
    public Optional<ClientResponse> findById(Long id) {
        return clientRepository.findByIdAndPractitionerId(id, CurrentPractitioner.requireId())
            .map(ClientMapper::toDto);
    }

    @Transactional(readOnly = true)
    public PagedResponse<ClientResponse> findAll(Pageable pageable) {
        Page<ClientEntity> page =
            clientRepository.findAllByPractitionerId(CurrentPractitioner.requireId(), pageable);
        return PagedResponse.from(page.map(ClientMapper::toDto));
    }

    @Transactional(readOnly = true)
    public PagedResponse<ClientResponse> search(String name, Pageable pageable) {
        Page<ClientEntity> page = clientRepository
            .findAllByPractitionerIdAndFullNameContainingIgnoreCase(
                CurrentPractitioner.requireId(), name, pageable);
        return PagedResponse.from(page.map(ClientMapper::toDto));
    }

    /**
     * Returns empty rather than throwing when the client belongs to someone else, so that the
     * caller renders a 404. A 403 would confirm the record exists, which is itself a leak.
     */
    public Optional<ClientResponse> update(Long id, ClientUpdateRequest request) {
        return clientRepository.findByIdAndPractitionerId(id, CurrentPractitioner.requireId())
            .map(client -> {
                client.setFullName(request.fullName().trim());
                client.setEmail(request.email());
                client.setPhone(request.phone());
                client.setDateOfBirth(request.dateOfBirth());
                client.setGoal(request.goal());
                client.setNotes(request.notes());
                return ClientMapper.toDto(clientRepository.save(client));
            });
    }

    public boolean delete(Long id) {
        return clientRepository.findByIdAndPractitionerId(id, CurrentPractitioner.requireId())
            .map(client -> {
                clientRepository.delete(client);
                return true;
            })
            .orElse(false);
    }

    @Transactional(readOnly = true)
    public long count() {
        return clientRepository.countByPractitionerId(CurrentPractitioner.requireId());
    }
}
