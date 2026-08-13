package com.ivi.app.measurement.mapper;

import com.ivi.app.measurement.dto.MeasurementResponse;
import com.ivi.app.measurement.dto.MeasurementSeriesResponse;
import com.ivi.app.measurement.dto.MeasurementTypeResponse;
import com.ivi.app.measurement.model.MeasurementEntity;
import com.ivi.app.measurement.model.MeasurementTypeEntity;

import java.util.List;

public final class MeasurementMapper {

    private MeasurementMapper() {
        // Utility class — no instantiation
    }

    public static MeasurementResponse toDto(MeasurementEntity measurement) {
        MeasurementTypeEntity type = measurement.getType();
        return new MeasurementResponse(
            measurement.getId(),
            measurement.getClientId(),
            type.getCode(),
            type.getLabelEl(),
            type.getUnit(),
            measurement.getValue(),
            measurement.getRecordedOn(),
            measurement.getNotes(),
            type.isOutOfRange(measurement.getValue()).orElse(null)
        );
    }

    public static MeasurementTypeResponse toDto(MeasurementTypeEntity type) {
        return new MeasurementTypeResponse(
            type.getCode(),
            type.getLabelEl(),
            type.getLabelEn(),
            type.getUnit(),
            type.getCategory().name(),
            type.getReferenceMin(),
            type.getReferenceMax(),
            type.getDecimals()
        );
    }

    public static List<MeasurementResponse> toDtoList(List<MeasurementEntity> measurements) {
        return measurements.stream().map(MeasurementMapper::toDto).toList();
    }

    public static List<MeasurementTypeResponse> toTypeDtoList(List<MeasurementTypeEntity> types) {
        return types.stream().map(MeasurementMapper::toDto).toList();
    }

    public static MeasurementSeriesResponse.Point toPoint(MeasurementEntity measurement,
                                                          MeasurementEntity previous,
                                                          MeasurementEntity first) {
        return new MeasurementSeriesResponse.Point(
            measurement.getRecordedOn(),
            measurement.getValue(),
            previous == null ? null : measurement.getValue().subtract(previous.getValue()),
            first == null ? null : measurement.getValue().subtract(first.getValue())
        );
    }
}
