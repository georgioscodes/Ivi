package com.ivi.app.export.service;

import com.ivi.app.shared.exception.BusinessException;
import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import com.openhtmltopdf.util.XRLog;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.logging.Level;

/**
 * Turns rendered HTML into a PDF.
 *
 * <p>The single thing this class exists to get right is the font. The PDF base-14 fonts do not
 * cover Greek: a plan rendered with them produces blank glyphs or mojibake in the document handed
 * to the client, the render itself succeeds, and nobody notices until a real client opens it. So
 * a font with verified Greek coverage is registered explicitly and the CSS names it for every
 * element, leaving nothing to fall back.
 *
 * <p>The font is bundled with the application rather than taken from the host, because a container
 * image cannot be assumed to carry system fonts.
 */
@Slf4j
@Component
public class PlanPdfRenderer {

    private static final String FONT_FAMILY = "DejaVu Sans";
    private static final String FONT_REGULAR = "fonts/DejaVuSans.ttf";
    private static final String FONT_BOLD = "fonts/DejaVuSans-Bold.ttf";

    /**
     * openhtmltopdf needs a File to register a font, but the font lives on the classpath and
     * inside a jar at runtime. Extracting once to a temp file at startup is the least awkward
     * way to bridge that, and keeps the cost off the request path.
     */
    private final Path regularFont;
    private final Path boldFont;

    public PlanPdfRenderer() {
        // openhtmltopdf logs at INFO through java.util.logging by default, which is noisy and
        // bypasses the application's structured logging entirely.
        XRLog.setLevel(XRLog.EXCEPTION, Level.WARNING);

        this.regularFont = extractToTempFile(FONT_REGULAR, "ivi-dejavu-sans", ".ttf");
        this.boldFont = extractToTempFile(FONT_BOLD, "ivi-dejavu-sans-bold", ".ttf");
    }

    public byte[] render(String html, String baseUri) {
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            PdfRendererBuilder builder = new PdfRendererBuilder();
            builder.useFastMode();

            // Registered before the document, so the family is resolvable when CSS is applied.
            builder.useFont(regularFont.toFile(), FONT_FAMILY, 400,
                PdfRendererBuilder.FontStyle.NORMAL, true);
            builder.useFont(boldFont.toFile(), FONT_FAMILY, 700,
                PdfRendererBuilder.FontStyle.NORMAL, true);

            builder.withHtmlContent(html, baseUri);
            builder.toStream(out);
            builder.run();

            return out.toByteArray();
        } catch (IOException ex) {
            throw new BusinessException("Could not render the plan as a PDF");
        }
    }

    private Path extractToTempFile(String classpathLocation, String prefix, String suffix) {
        try (InputStream in = new ClassPathResource(classpathLocation).getInputStream()) {
            Path target = Files.createTempFile(prefix, suffix);
            target.toFile().deleteOnExit();
            Files.copy(in, target, StandardCopyOption.REPLACE_EXISTING);
            return target;
        } catch (IOException ex) {
            // Failing at startup is right: a PDF without this font is silently wrong rather
            // than obviously broken, which is far worse than not starting.
            throw new IllegalStateException(
                "Could not load the bundled font " + classpathLocation
                    + ". Greek text cannot be rendered without it.", ex);
        }
    }
}
