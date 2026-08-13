package com.ivi.app.measurement.controller;

import com.ivi.app.measurement.dto.MeasurementBatchRequest;
import com.ivi.app.measurement.dto.MeasurementRecordRequest;
import com.ivi.app.measurement.dto.MeasurementResponse;
import com.ivi.app.measurement.dto.MeasurementSeriesResponse;
import com.ivi.app.measurement.dto.MeasurementSummaryResponse;
import com.ivi.app.measurement.dto.MeasurementTypeResponse;
import com.ivi.app.measurement.service.MeasurementService;
import com.ivi.app.shared.dto.PagedResponse;
import com.ivi.app.shared.exception.ResourceNotFoundException;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/measurement")
@RequiredArgsConstructor
public class MeasurementController {

    private final MeasurementService measurementService;

    /** What can be measured. Reference data, the same for every practitioner. */
    @GetMapping("/type")
    public ResponseEntity<List<MeasurementTypeResponse>> types() {
        return ResponseEntity.ok(measurementService.types());
    }

    @PostMapping
    public ResponseEntity<MeasurementResponse> record(
            @Valid @RequestBody MeasurementRecordRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(measurementService.record(request));
    }

    /** Several values from one session, so a full set of readings is one request. */
    @PostMapping("/batch")
    public ResponseEntity<List<MeasurementResponse>> recordBatch(
            @Valid @RequestBody MeasurementBatchRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(measurementService.recordBatch(request));
    }

    @GetMapping
    public ResponseEntity<PagedResponse<MeasurementResponse>> forClient(
            @RequestParam Long clientId,
            @PageableDefault(size = 50) Pageable pageable) {
        return ResponseEntity.ok(measurementService.findForClient(clientId, pageable));
    }

    /** One type's history, with the deltas a change chart needs. */
    @GetMapping("/series")
    public ResponseEntity<MeasurementSeriesResponse> series(@RequestParam Long clientId,
                                                            @RequestParam String typeCode) {
        return ResponseEntity.ok(measurementService.series(clientId, typeCode));
    }

    /** Latest value of every type, plus BMI where weight and height are both known. */
    @GetMapping("/summary")
    public ResponseEntity<MeasurementSummaryResponse> summary(@RequestParam Long clientId) {
        return ResponseEntity.ok(measurementService.summary(clientId));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (!measurementService.delete(id)) {
            throw new ResourceNotFoundException("Measurement", id);
        }
        return ResponseEntity.noContent().build();
    }
}
