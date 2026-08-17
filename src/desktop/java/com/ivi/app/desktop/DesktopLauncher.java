package com.ivi.app.desktop;

import com.ivi.app.IviApplication;
import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;

import javax.sql.DataSource;
import java.awt.Desktop;
import java.io.IOException;
import java.io.InputStream;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Entry point for the desktop preview build.
 *
 * <p>The practitioner this is built for has neither Java nor Docker and should not have to
 * acquire either, so this starts its own PostgreSQL, boots the application against it, loads the
 * demo data, and opens a browser — from one double click.
 *
 * <p>This is a preview vehicle, not a distribution channel. MVP feature 9 is "cloud,
 * browser-based, no installation", and nothing here changes that.
 *
 * <p>Note what this class is <em>not</em>: there is no {@code desktop} Spring profile and no
 * second {@code application.yml}. The application configures itself from environment variables
 * with defaults, and every setting that differs here is passed straight to
 * {@link SpringApplicationBuilder}. In a cloud deployment this class is not disabled by a
 * condition — its {@code main} is simply never called.
 */
public final class DesktopLauncher {

    /** Tried first so the URL is predictable; the next free port is used if it is taken. */
    private static final int PREFERRED_PORT = 8080;
    private static final int PORT_SCAN_LIMIT = 40;

    private static final String DEMO_DATA_RESOURCE = "demo-data.sql";

    private DesktopLauncher() {
    }

    public static void main(String[] args) {
        // Before anything can fail, so a failure has somewhere to be reported. A stack trace in
        // a console the practitioner cannot see is the same as no error at all.
        Thread.setDefaultUncaughtExceptionHandler(
            (thread, error) -> ControlWindow.showFatalError(error));

        try {
            start(args);
        } catch (Exception e) {
            ControlWindow.showFatalError(e);
            System.exit(1);
        }
    }

    private static void start(String[] args) throws Exception {
        Path home = applicationDirectory();
        Path databaseDirectory = home.resolve("database");
        Files.createDirectories(databaseDirectory);

        Splash splash = Splash.display();

        splash.status("Starting the database…");
        EmbeddedPostgres postgres = EmbeddedPostgres.builder()
            .setDataDirectory(databaseDirectory.toFile())
            // Without this the data directory is wiped on every start, and the practitioner
            // loses whatever they entered last session.
            .setCleanDataDirectory(false)
            .start();

        // Stops the server even if the JVM is killed without going through Quit, which would
        // otherwise leave a lock file that blocks the next start.
        Runtime.getRuntime().addShutdownHook(new Thread(() -> closeQuietly(postgres)));

        int httpPort = availablePort();
        URI address = URI.create("http://localhost:" + httpPort + "/");

        splash.status("Starting Ivi…");
        ConfigurableApplicationContext context = bootApplication(postgres, httpPort, args);

        splash.status("Preparing the demo data…");
        DataSource dataSource = context.getBean(DataSource.class);
        if (isEmpty(dataSource)) {
            loadDemoData(dataSource);
        }

        splash.close();

        ControlWindow.show(address, () -> resetDemoData(dataSource), () -> {
            context.close();
            closeQuietly(postgres);
            System.exit(0);
        });

        openBrowser(address);
    }

    private static ConfigurableApplicationContext bootApplication(EmbeddedPostgres postgres,
                                                                  int httpPort,
                                                                  String[] args) {
        Map<String, Object> properties = new LinkedHashMap<>();
        properties.put("spring.datasource.url",
            "jdbc:postgresql://localhost:" + postgres.getPort() + "/postgres");
        // The embedded server authenticates by trust on loopback and runs its superuser as
        // "postgres". Superuser matters: V1__baseline.sql creates the citext extension.
        properties.put("spring.datasource.username", "postgres");
        properties.put("spring.datasource.password", "");
        properties.put("server.port", httpPort);
        // Loopback only. Binding to every interface would publish client records to whatever
        // network the practitioner's laptop is on, and would trip a firewall prompt on Windows
        // that they should not have to answer.
        properties.put("server.address", "127.0.0.1");
        // A tester who steps away mid-consultation should not lose their place.
        properties.put("spring.session.timeout", "8h");

        return new SpringApplicationBuilder(IviApplication.class)
            // Spring Boot forces headless mode by default, which would leave the tray icon and
            // the browser launch silently doing nothing.
            .headless(false)
            .properties(properties)
            .run(args);
    }

    // --- demo data ---------------------------------------------------------------------------

    private static boolean isEmpty(DataSource dataSource) throws Exception {
        try (Connection connection = dataSource.getConnection();
             Statement statement = connection.createStatement();
             ResultSet resultSet = statement.executeQuery("SELECT count(*) FROM practitioner")) {
            return resultSet.next() && resultSet.getInt(1) == 0;
        }
    }

    /**
     * Loads the fabricated demo data.
     *
     * <p>Executed as a single statement rather than through Spring's {@code ScriptUtils}, which
     * splits on semicolons and does not understand dollar quoting — it would cut the generated
     * script's {@code DO $$ … $$} block in half. The PostgreSQL driver accepts a multi-statement
     * string directly, so the script is handed over whole.
     */
    static void loadDemoData(DataSource dataSource) throws Exception {
        String sql = readResource();
        try (Connection connection = dataSource.getConnection();
             Statement statement = connection.createStatement()) {
            statement.execute(sql);
        }
    }

    private static void resetDemoData(DataSource dataSource) {
        try {
            // The generated script truncates before loading, so re-running it is how "reset"
            // is implemented — no separate teardown to keep in step with it.
            loadDemoData(dataSource);
        } catch (Exception e) {
            throw new IllegalStateException("Could not reset the demo data", e);
        }
    }

    private static String readResource() throws IOException {
        try (InputStream in = DesktopLauncher.class.getClassLoader()
                .getResourceAsStream(DEMO_DATA_RESOURCE)) {
            if (in == null) {
                throw new IOException(DEMO_DATA_RESOURCE + " is missing from the bundle");
            }
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    // --- environment -------------------------------------------------------------------------

    /**
     * Where the database lives between runs.
     *
     * <p>Per-user application data, not the installation directory: the bundle may sit somewhere
     * unwritable, and on Windows it very often does.
     */
    static Path applicationDirectory() {
        String os = System.getProperty("os.name", "").toLowerCase();
        if (os.contains("win")) {
            String localAppData = System.getenv("LOCALAPPDATA");
            if (localAppData != null && !localAppData.isBlank()) {
                return Paths.get(localAppData, "Ivi");
            }
        } else if (os.contains("mac")) {
            return Paths.get(System.getProperty("user.home"), "Library", "Application Support", "Ivi");
        }
        return Paths.get(System.getProperty("user.home"), ".ivi");
    }

    private static int availablePort() throws IOException {
        for (int port = PREFERRED_PORT; port < PREFERRED_PORT + PORT_SCAN_LIMIT; port++) {
            if (isFree(port)) {
                return port;
            }
        }
        // Nothing in the preferred range; let the OS choose.
        try (ServerSocket socket = new ServerSocket(0, 1, InetAddress.getLoopbackAddress())) {
            return socket.getLocalPort();
        }
    }

    private static boolean isFree(int port) {
        try (ServerSocket socket = new ServerSocket(port, 1, InetAddress.getLoopbackAddress())) {
            socket.setReuseAddress(true);
            return true;
        } catch (IOException taken) {
            return false;
        }
    }

    static void openBrowser(URI address) {
        try {
            if (Desktop.isDesktopSupported() && Desktop.getDesktop().isSupported(Desktop.Action.BROWSE)) {
                Desktop.getDesktop().browse(address);
                return;
            }
        } catch (Exception ignored) {
            // Falls through to the control window, which shows the address to open by hand.
        }
        ControlWindow.reportBrowserFailure(address);
    }

    private static void closeQuietly(EmbeddedPostgres postgres) {
        try {
            postgres.close();
        } catch (Exception ignored) {
            // Shutting down; nothing useful left to do about it.
        }
    }
}
