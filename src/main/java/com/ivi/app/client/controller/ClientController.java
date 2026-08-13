package com.ivi.app.client.controller;

import com.ivi.app.client.dto.ClientCreateRequest;
import com.ivi.app.client.dto.ClientResponse;
import com.ivi.app.client.dto.ClientUpdateRequest;
import com.ivi.app.client.service.ClientService;
import com.ivi.app.shared.dto.PagedResponse;
import com.ivi.app.shared.exception.ResourceNotFoundException;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/client")
@RequiredArgsConstructor
public class ClientController {

    private final ClientService clientService;

    @PostMapping
    public ResponseEntity<ClientResponse> create(@Valid @RequestBody ClientCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(clientService.create(request));
    }

    /**
     * A client owned by another practitioner produces a 404, never a 403. A 403 would confirm
     * that the id exists, letting a caller map out another practice's records by probing.
     */
    @GetMapping("/{id}")
    public ResponseEntity<ClientResponse> getById(@PathVariable Long id) {
        return clientService.viewById(id)
            .map(ResponseEntity::ok)
            .orElseThrow(() -> new ResourceNotFoundException("Client", id));
    }

    @GetMapping
    public ResponseEntity<PagedResponse<ClientResponse>> getAll(
            @RequestParam(required = false) String name,
            @PageableDefault(size = 20, sort = "fullName", direction = Sort.Direction.ASC)
            Pageable pageable) {

        return ResponseEntity.ok(name == null || name.isBlank()
            ? clientService.findAll(pageable)
            : clientService.search(name.trim(), pageable));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ClientResponse> update(@PathVariable Long id,
                                                 @Valid @RequestBody ClientUpdateRequest request) {
        return clientService.update(id, request)
            .map(ResponseEntity::ok)
            .orElseThrow(() -> new ResourceNotFoundException("Client", id));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (!clientService.delete(id)) {
            throw new ResourceNotFoundException("Client", id);
        }
        return ResponseEntity.noContent().build();
    }
}
