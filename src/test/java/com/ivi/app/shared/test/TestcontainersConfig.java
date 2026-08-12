package com.ivi.app.shared.test;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

/**
 * Single Postgres container shared by every test that needs a database.
 *
 * Imported with {@code @Import(TestcontainersConfig.class)} rather than inherited from a base
 * class. Spring's context caching keeps one container alive across all test classes that share
 * this configuration, so the startup cost is paid once per build.
 */
@TestConfiguration(proxyBeanMethods = false)
public class TestcontainersConfig {

    @Bean
    @ServiceConnection
    PostgreSQLContainer<?> postgresContainer() {
        return new PostgreSQLContainer<>(DockerImageName.parse("postgres:16-alpine"));
    }
}
