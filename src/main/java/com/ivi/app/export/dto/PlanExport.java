package com.ivi.app.export.dto;

/**
 * A rendered plan and the name it should be saved under.
 *
 * <p>The two travel together because only the service can produce the filename: it is built from
 * the client's name, which the controller does not have and should not fetch a second time.
 */
public record PlanExport(byte[] content, String fileName) {}
