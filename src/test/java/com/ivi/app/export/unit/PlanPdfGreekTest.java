package com.ivi.app.export.unit;

import com.ivi.app.export.service.PlanPdfRenderer;
import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDResources;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Whether Greek survives into the PDF.
 *
 * <p>This is asserted on extracted text rather than inspected by eye, because the failure mode is
 * silent: a font without Greek coverage renders blank glyphs or mojibake while the render itself
 * reports success. Nobody notices until a client opens the document.
 *
 * <p>The characters exercised below are chosen for where partial coverage actually breaks —
 * final sigma, the tonos forms, and the dialytika combinations such as ΐ in "πρωτεΐνες", which
 * fonts claiming Greek support frequently omit.
 */
class PlanPdfGreekTest {

    private PlanPdfRenderer renderer;

    @BeforeEach
    void setUp() {
        renderer = new PlanPdfRenderer();
    }

    @Test
    void shouldRoundTripGreekText_whenRenderedToPdf() throws IOException {
        // Given — the vocabulary a real plan is built from
        String greek = "Διαιτολόγιο Δευτέρας: Ελαιόλαδο, Γιαούρτι στραγγιστό, Παξιμάδι κρίθινο";

        // When
        String extracted = extractText(renderer.render(html(greek), null));

        // Then
        assertThat(extracted).contains(greek);
    }

    @ParameterizedTest(name = "{0}")
    @ValueSource(strings = {
        "πρωτεΐνες",        // dialytika + tonos on iota (U+0390) — the usual casualty
        "Υδατάνθρακες",     // final sigma
        "Χωριάτικη σαλάτα", // tonos on alpha
        "Μυϊκή μάζα",       // dialytika on iota
        "ΰ",                // upsilon with dialytika and tonos (U+03B0)
        "Άλας Έδεσμα Ήπαρ", // uppercase with tonos
        "Ωμέγα-3 λιπαρά",   // omega, plus a digit and hyphen in the same run
        "Γραβιέρα Νάξου"
    })
    void shouldPreserveEveryGreekForm_whenExtractedBack(String text) throws IOException {
        // When
        String extracted = extractText(renderer.render(html(text), null));

        // Then — exact round trip, not a lenient contains-some-letters check
        assertThat(extracted).contains(text);
    }

    @Test
    void shouldNotProduceReplacementCharacters_whenRenderingGreek() throws IOException {
        // Given
        String greek = "Πρωινό: αυγό, ψωμί ολικής άλεσης, πορτοκάλι";

        // When
        String extracted = extractText(renderer.render(html(greek), null));

        // Then — the shapes a failed glyph lookup takes. The run of hashes is not a guess:
        // it is what this renderer actually emits without a Greek font, as
        // shouldFailWithoutTheBundledFont below demonstrates.
        assertThat(extracted)
            .doesNotContain("###")
            .doesNotContain("\uFFFD")
            .doesNotContain("???")
            .doesNotContain("\u25A1");
    }

    /**
     * The control that gives the tests above their meaning.
     *
     * <p>Without the bundled font, Greek does not merely look wrong — it is gone, replaced by a
     * run of hashes, and the render still reports success. This test asserts that failure so the
     * others cannot quietly pass for some reason unrelated to the font: it proves the font
     * registration is what is doing the work.
     */
    @Test
    void shouldFailWithoutTheBundledFont_provingTheChecksAboveAreMeaningful() throws IOException {
        // Given — a base-14 family, no font registered
        String html = """
            <html><head><meta charset="UTF-8"/>
            <style>* { font-family: Helvetica, sans-serif; }</style>
            </head><body><p>Διαιτολόγιο πρωτεΐνες</p></body></html>
            """;

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        PdfRendererBuilder builder = new PdfRendererBuilder();
        builder.useFastMode();
        builder.withHtmlContent(html, null);
        builder.toStream(out);

        // When — note this does NOT throw. That is the whole problem.
        builder.run();

        // Then
        String extracted = extractText(out.toByteArray());
        assertThat(extracted)
            .as("Greek must not survive without the bundled font, or these tests prove nothing")
            .doesNotContain("Διαιτολόγιο")
            .doesNotContain("πρωτεΐνες");
    }

    @Test
    void shouldEmbedTheFont_soTheDocumentRendersAwayFromThisMachine() throws IOException {
        // Given
        byte[] pdf = renderer.render(html("Διαιτολόγιο"), null);

        // When
        List<PDFont> fonts = fontsIn(pdf);

        // Then — extraction can succeed on a referenced font while the glyphs are absent on the
        // reader's machine, so embedding is checked separately from the text round trip.
        assertThat(fonts).isNotEmpty();
        assertThat(fonts).anyMatch(PDFont::isEmbedded);
        assertThat(fonts).allMatch(font -> font.getName() != null
            && font.getName().contains("DejaVu"));
    }

    @Test
    void shouldRenderGreekInBoldAsWell_whenTheStyleIsApplied() throws IOException {
        // Given — bold is a separate font file, so it is a separate opportunity to fail
        String html = """
            <html><head><meta charset="UTF-8"/>
            <style>* { font-family: "DejaVu Sans"; } b { font-weight: 700; }</style>
            </head><body><b>Σύνολο ημέρας</b> κανονικό κείμενο</body></html>
            """;

        // When
        String extracted = extractText(renderer.render(html, null));

        // Then
        assertThat(extracted).contains("Σύνολο ημέρας");
        assertThat(extracted).contains("κανονικό κείμενο");
    }

    @Test
    void shouldProduceAValidPdf_whenRendering() throws IOException {
        // When
        byte[] pdf = renderer.render(html("Διαιτολόγιο"), null);

        // Then
        assertThat(pdf).isNotEmpty();
        assertThat(new String(pdf, 0, 5, java.nio.charset.StandardCharsets.ISO_8859_1))
            .isEqualTo("%PDF-");

        try (PDDocument document = Loader.loadPDF(pdf)) {
            assertThat(document.getNumberOfPages()).isEqualTo(1);
        }
    }

    private String html(String body) {
        return """
            <html><head><meta charset="UTF-8"/>
            <style>* { font-family: "DejaVu Sans", sans-serif; }</style>
            </head><body><p>%s</p></body></html>
            """.formatted(body);
    }

    private String extractText(byte[] pdf) throws IOException {
        try (PDDocument document = Loader.loadPDF(pdf)) {
            PDFTextStripper stripper = new PDFTextStripper();
            stripper.setSortByPosition(true);
            return stripper.getText(document);
        }
    }

    private List<PDFont> fontsIn(byte[] pdf) throws IOException {
        List<PDFont> fonts = new ArrayList<>();
        try (PDDocument document = Loader.loadPDF(pdf)) {
            for (PDPage page : document.getPages()) {
                PDResources resources = page.getResources();
                for (var name : resources.getFontNames()) {
                    fonts.add(resources.getFont(name));
                }
            }
        }
        return fonts;
    }
}
