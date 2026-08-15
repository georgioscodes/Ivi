package com.ivi.app;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Scheduling is enabled for one job: sweeping expired login-attempt counters. Every instance runs
 * it, which is fine — the sweep is an idempotent delete of rows nothing else reads. Anything added
 * here later that is <em>not</em> idempotent will need leader election, which this application
 * does not have.
 */
@SpringBootApplication
@ConfigurationPropertiesScan
@EnableScheduling
public class IviApplication {

    public static void main(String[] args) {
        SpringApplication.run(IviApplication.class, args);
    }
}
