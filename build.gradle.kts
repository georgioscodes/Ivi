import com.github.gradle.node.npm.task.NpmTask

plugins {
    java
    id("org.springframework.boot") version "3.4.2"
    id("io.spring.dependency-management") version "1.1.7"
    id("com.github.node-gradle.node") version "7.1.0"
}

group = "com.ivi"
version = "0.0.1-SNAPSHOT"

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

configurations {
    compileOnly {
        extendsFrom(configurations.annotationProcessor.get())
    }
}

repositories {
    mavenCentral()
}

extra["testcontainersVersion"] = "1.20.4"

dependencies {
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    implementation("org.springframework.boot:spring-boot-starter-validation")
    implementation("org.springframework.boot:spring-boot-starter-actuator")
    implementation("org.springframework.boot:spring-boot-starter-security")

    // Sessions are stored in Postgres, not Redis: revocable without a second component.
    implementation("org.springframework.session:spring-session-jdbc")

    implementation("org.springframework.boot:spring-boot-starter-thymeleaf")

    // HTML -> PDF rather than programmatic drawing: Phase 1 makes the print layout
    // user-configurable, and parameterising a template is tractable where parameterising
    // imperative drawing code is not.
    implementation("io.github.openhtmltopdf:openhtmltopdf-core:1.1.22")
    implementation("io.github.openhtmltopdf:openhtmltopdf-pdfbox:1.1.22")

    implementation("org.flywaydb:flyway-core")
    implementation("org.flywaydb:flyway-database-postgresql")
    runtimeOnly("org.postgresql:postgresql")

    // Structured JSON logging — mandated by the spring-boot-clean-code skill.
    implementation("net.logstash.logback:logstash-logback-encoder:8.0")

    compileOnly("org.projectlombok:lombok")
    annotationProcessor("org.projectlombok:lombok")

    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("org.springframework.boot:spring-boot-testcontainers")
    testImplementation("org.testcontainers:junit-jupiter")
    testImplementation("org.testcontainers:postgresql")
    testImplementation("com.tngtech.archunit:archunit-junit5:1.3.0")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

dependencyManagement {
    imports {
        mavenBom("org.testcontainers:testcontainers-bom:${property("testcontainersVersion")}")
    }
}

tasks.withType<Test> {
    useJUnitPlatform()
}

// --- Frontend -----------------------------------------------------------------------------
//
// React + TypeScript + Vite under src/main/frontend, compiled into this jar's static resources.
// One artifact: the UI is versioned, built and deployed with the API that serves it, so there is
// no window in which a deployed frontend is talking to a backend it was not built against.
//
// Node is downloaded and pinned rather than taken from the PATH, so the build does not depend on
// what happens to be installed on a developer's machine or a CI image.

val frontendDir = layout.projectDirectory.dir("src/main/frontend")
val frontendDist = layout.buildDirectory.dir("frontend")

node {
    version = "22.14.0"
    download = true
    nodeProjectDir = frontendDir
    // Install from the lockfile. `npm install` would silently resolve newer transitive versions,
    // which makes a build irreproducible.
    npmInstallCommand = "ci"
}

val frontendBuild = tasks.register<NpmTask>("frontendBuild") {
    group = "build"
    description = "Compiles the React frontend into build/frontend."

    dependsOn(tasks.npmInstall)
    npmCommand = listOf("run", "build")

    // Declared so an unchanged frontend is skipped. Without these Vite re-runs on every backend
    // change, which is most of them.
    inputs.dir(frontendDir.dir("src")).withPathSensitivity(PathSensitivity.RELATIVE)
    // public/ is copied verbatim into the bundle. Left out of this list, a changed favicon or
    // a new static file looks up-to-date and never reaches the jar.
    inputs.dir(frontendDir.dir("public")).withPathSensitivity(PathSensitivity.RELATIVE)
    inputs.file(frontendDir.file("index.html"))
    inputs.file(frontendDir.file("vite.config.ts"))
    inputs.file(frontendDir.file("tsconfig.json"))
    inputs.file(frontendDir.file("package.json"))
    inputs.file(frontendDir.file("package-lock.json"))
    outputs.dir(frontendDist)
}

val frontendTypecheck = tasks.register<NpmTask>("frontendTypecheck") {
    group = "verification"
    description = "Type-checks the frontend. Vite strips types without checking them."

    dependsOn(tasks.npmInstall)
    npmCommand = listOf("run", "typecheck")

    inputs.dir(frontendDir.dir("src")).withPathSensitivity(PathSensitivity.RELATIVE)
    inputs.file(frontendDir.file("tsconfig.json"))
    inputs.file(frontendDir.file("vite.config.ts"))
    outputs.upToDateWhen { false }
}

tasks.named("check") {
    dependsOn(frontendTypecheck)
}

tasks.processResources {
    dependsOn(frontendBuild)
    from(frontendDist) {
        into("static")
    }
}
