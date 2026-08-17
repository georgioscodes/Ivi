import com.github.gradle.node.npm.task.NpmTask
import org.springframework.boot.gradle.tasks.bundling.BootJar

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

extra["testcontainersVersion"] = "1.21.4"

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

val frontendTest = tasks.register<NpmTask>("frontendTest") {
    group = "verification"
    description = "Runs the frontend unit tests."

    dependsOn(tasks.npmInstall)
    npmCommand = listOf("run", "test")

    inputs.dir(frontendDir.dir("src")).withPathSensitivity(PathSensitivity.RELATIVE)
    inputs.file(frontendDir.file("vite.config.ts"))
    outputs.upToDateWhen { false }
}

/**
 * The end-to-end suite, against a running application.
 *
 * Deliberately **not** wired into `check`. These tests need the jar serving on a port and a real
 * database behind it, so making the ordinary build depend on them would mean `./gradlew build`
 * fails on a machine that simply has not started the application — and a check that fails for
 * reasons unrelated to the change is a check people learn to skip.
 *
 * Run it against whatever is already up:
 *
 *     ./gradlew e2e                      # localhost:8080
 *     IVI_BASE_URL=https://... ./gradlew e2e
 *
 * `IVI_CHROMIUM` points Playwright at a browser the machine already has, instead of downloading
 * one. See playwright.config.ts.
 */
val e2e = tasks.register<NpmTask>("e2e") {
    group = "verification"
    description = "Runs the Playwright end-to-end suite against a running application."

    dependsOn(tasks.npmInstall)
    npmCommand = listOf("run", "test:e2e")

    // Never up-to-date: the thing under test is a running server, not these files.
    outputs.upToDateWhen { false }
}

tasks.named("check") {
    dependsOn(frontendTypecheck, frontendTest)
}

tasks.processResources {
    dependsOn(frontendBuild)
    from(frontendDist) {
        into("static")
    }
}

// --- Desktop preview build ------------------------------------------------------------------
//
// A double-clickable bundle for putting the application in front of a practitioner who has
// neither Java nor Docker, and should not have to acquire either. It is a preview vehicle, not
// a distribution channel — MVP feature 9 is "cloud, browser-based, no installation".
//
// Deliberately a separate source set rather than part of the application:
//
//   * Embedded PostgreSQL carries tens of megabytes of native binaries, and the tray icon drags
//     in Swing. Neither has any business in a Cloud Run image. `bootJar` never sees this
//     configuration, so the deployed artifact is byte-for-byte what it was before.
//   * There is no `desktop` Spring profile. This project configures itself from environment
//     variables with defaults, and a profile would be a second, divergent way to do the same
//     thing. DesktopLauncher passes its settings to SpringApplicationBuilder directly, so the
//     cloud path is not merely disabled here — it is never entered.
//
// See scripts/README.md for how to build and what the practitioner receives.

val desktop: SourceSet by sourceSets.creating {
    // The launcher boots IviApplication in-process, so it compiles against the application and
    // packages the application's classes — including the compiled frontend — into its own jar.
    compileClasspath += sourceSets.main.get().output
    runtimeClasspath += sourceSets.main.get().output
}

configurations["desktopImplementation"].extendsFrom(configurations.implementation.get())
configurations["desktopRuntimeOnly"].extendsFrom(configurations.runtimeOnly.get())

/*
 * Which PostgreSQL binaries to embed. jpackage can only produce a bundle for the platform it
 * runs on, so by default this follows the build host and each bundle carries one platform's
 * binaries instead of all five. Override to check the dependency resolves for another platform
 * without being on it:
 *
 *     ./gradlew desktopJar -PdesktopPlatform=windows-amd64
 */
val desktopPlatform: String = (findProperty("desktopPlatform") as String?) ?: run {
    val os = System.getProperty("os.name").lowercase()
    val arch = System.getProperty("os.arch").lowercase()
    when {
        os.contains("win") -> "windows-amd64"
        os.contains("mac") && (arch.contains("aarch64") || arch.contains("arm")) -> "darwin-arm64v8"
        os.contains("mac") -> "darwin-amd64"
        else -> "linux-amd64"
    }
}

dependencies {
    // The default dependency drags in binaries for every platform. Excluded, then exactly one
    // is added back.
    "desktopImplementation"("io.zonky.test:embedded-postgres:2.1.0") {
        exclude(group = "io.zonky.test.postgres")
    }
    "desktopImplementation"(platform("io.zonky.test.postgres:embedded-postgres-binaries-bom:16.2.0"))
    "desktopRuntimeOnly"("io.zonky.test.postgres:embedded-postgres-binaries-$desktopPlatform")
}

val desktopJar = tasks.register<BootJar>("desktopJar") {
    group = "distribution"
    description = "Executable jar for the desktop preview: application, UI, and an embedded database."

    mainClass = "com.ivi.app.desktop.DesktopLauncher"
    archiveClassifier = "desktop"
    // Contains the main output as a directory, so the application's classes and the compiled
    // frontend land in BOOT-INF/classes where the Spring Boot loader expects them. A launcher
    // merely placed beside the fat jar could not see them.
    classpath = desktop.runtimeClasspath
    // The plugin's own bootJar picks this up from the java extension; one registered by hand
    // has to be told.
    targetJavaVersion = java.toolchain.languageVersion.map { JavaVersion.toVersion(it.asInt()) }
}

/**
 * The double-clickable bundle: `Ivi.app` on macOS, `Ivi.exe` and its runtime on Windows.
 *
 * jpackage bundles a Java runtime, so the target machine needs nothing installed. It can only
 * build for the platform it runs on — the Windows bundle has to be produced on Windows.
 *
 *     ./gradlew packageDesktop
 */
// jpackage packages every file in --input, so the desktop jar is staged on its own. Pointed at
// build/libs it would carry bootJar and the plain jar along too, for another 67 MB of dead weight.
val stageDesktopJar = tasks.register<Sync>("stageDesktopJar") {
    from(desktopJar)
    into(layout.buildDirectory.dir("desktop-input"))
}

val packageDesktop = tasks.register<Exec>("packageDesktop") {
    group = "distribution"
    description = "Builds a self-contained desktop application around desktopJar."

    dependsOn(stageDesktopJar)

    val outputDir = layout.buildDirectory.dir("desktop")
    val inputDir = layout.buildDirectory.dir("desktop-input")
    val jarName = desktopJar.flatMap { it.archiveFileName }

    // --type app-image produces a directory rather than an installer. That avoids WiX on
    // Windows and any need for administrator rights: the practitioner unzips it and runs it.
    val isWindows = System.getProperty("os.name").lowercase().contains("win")

    /*
     * Version of the bundle, which is not the version of the application. macOS rejects an
     * app-version whose first number is zero, so 0.0.1-SNAPSHOT cannot be passed through.
     * Nothing depends on the two agreeing — this number exists to satisfy the packagers and to
     * tell one preview build from the next.
     */
    val bundleVersion = (findProperty("desktopVersion") as String?) ?: "1.0.0"

    argumentProviders.add(CommandLineArgumentProvider {
        listOf(
            "--type", "app-image",
            "--name", "Ivi",
            "--app-version", bundleVersion,
            "--vendor", "Ivi",
            "--input", inputDir.get().asFile.absolutePath,
            "--main-jar", jarName.get(),
            /*
             * Deliberately no --main-class. In a Spring Boot jar the application's classes live
             * under BOOT-INF/classes, which is not on the plain classpath, so naming
             * DesktopLauncher here produces a ClassNotFoundException at launch. Left out,
             * jpackage uses the jar's Main-Class — the Spring Boot loader — which reads
             * Start-Class from the same manifest and starts DesktopLauncher through the nested
             * classloader that can actually see it.
             */
            "--dest", outputDir.get().asFile.absolutePath,
            // Headless would kill the tray icon and the browser launch. Xss is raised because
            // the PDF renderer recurses deeply on complex plans.
            "--java-options", "-Djava.awt.headless=false",
            "--java-options", "-Xss2m"
        ) + if (isWindows) {
            // Without a console, a failure before the Swing error dialog exists is invisible.
            listOf("--win-console")
        } else {
            emptyList()
        }
    })

    doFirst {
        // Resolved here rather than at configuration time so that merely configuring the build
        // does not require the toolchain to be present.
        executable = jpackageExecutable()
        // jpackage refuses to write over an existing bundle.
        delete(outputDir.get().asFile.resolve(if (isWindows) "Ivi" else "Ivi.app"))
        outputDir.get().asFile.mkdirs()
    }

    doLast {
        logger.lifecycle("Desktop bundle: ${outputDir.get().asFile.absolutePath}")
    }
}

/**
 * Zips the bundle into the one file that actually gets sent to the practitioner.
 *
 *     ./gradlew distDesktop
 */
tasks.register<Zip>("distDesktop") {
    group = "distribution"
    description = "Zips the desktop bundle for delivery."

    dependsOn(packageDesktop)

    from(layout.buildDirectory.dir("desktop"))
    archiveFileName = "Ivi-$desktopPlatform.zip"
    destinationDirectory = layout.buildDirectory.dir("distributions")

    // The launcher and, on macOS, everything inside the .app must stay executable. Zip drops
    // the permission bits by default, and an unzipped bundle that cannot be run is a puzzle the
    // practitioner has no way to solve.
    filePermissions { unix("rwxr-xr-x") }

    doLast {
        logger.lifecycle("Send this file: ${archiveFile.get().asFile.absolutePath}")
    }
}

/** jpackage lives in the JDK running Gradle; the toolchain's bin directory is where to look. */
fun jpackageExecutable(): String {
    val javaHome = javaToolchains.launcherFor(java.toolchain).get().metadata.installationPath
    val name = if (System.getProperty("os.name").lowercase().contains("win")) "jpackage.exe" else "jpackage"
    return javaHome.file("bin/$name").asFile.absolutePath
}
