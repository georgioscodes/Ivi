package com.ivi.app.shared.unit;

import com.ivi.app.shared.logging.SensitiveDataMasker;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;

class SensitiveDataMaskerTest {

    private SensitiveDataMasker masker;

    @BeforeEach
    void setUp() {
        masker = new SensitiveDataMasker();
    }

    @ParameterizedTest(name = "{0}")
    @ValueSource(strings = {"password", "newPassword", "accessToken", "clientSecret", "otp", "apiKey"})
    void shouldRemoveCredentialsEntirely_ratherThanTokenisingThem(String key) {
        // Given
        String body = "{\"%s\":\"super-secret-passphrase\"}".formatted(key);

        // When / Then — a token would still be a fact about the password
        assertThat(masker.mask(body))
            .doesNotContain("super-secret-passphrase")
            .contains("[REDACTED]");
    }

    @Test
    void shouldReplaceNamesWithATokenThatDoesNotRevealThem() {
        // Given
        String body = "{\"fullName\":\"Ελένη Παπαδοπούλου\",\"displayName\":\"Βασίλης Κ.\"}";

        // When
        String masked = masker.mask(body);

        // Then
        assertThat(masked)
            .doesNotContain("Ελένη")
            .doesNotContain("Παπαδοπούλου")
            .doesNotContain("Βασίλης")
            .contains("[id:");
    }

    @Test
    void shouldGiveTheSamePersonTheSameToken_soRequestsStayTraceable() {
        // Given — the same client across two separate requests
        String first = masker.mask("{\"fullName\":\"Ελένη Παπαδοπούλου\"}");
        String second = masker.mask("{\"fullName\":\"Ελένη Παπαδοπούλου\"}");
        String other = masker.mask("{\"fullName\":\"Γιώργος Νικολάου\"}");

        // Then — correlation without identification, which is the point of tokenising
        assertThat(first).isEqualTo(second);
        assertThat(first).isNotEqualTo(other);
    }

    @Test
    void shouldTreatTheSameNameAlike_regardlessOfCaseOrSurroundingSpace() {
        // Given / When
        String plain = masker.mask("{\"fullName\":\"Ελένη\"}");
        String padded = masker.mask("{\"fullName\":\"  Ελένη  \"}");

        // Then
        assertThat(plain).isEqualTo(padded);
    }

    @Test
    void shouldMaskEmails_whetherOrNotTheKeyLooksLikeAnEmail() {
        // Given — one under an email key, one buried in a field nothing marked sensitive
        String body = "{\"email\":\"eleni@example.gr\",\"summary\":\"contact vasilis@clinic.gr today\"}";

        // When
        String masked = masker.mask(body);

        // Then — addresses turn up in free text, so pattern matching backs up key matching
        assertThat(masked)
            .doesNotContain("eleni@example.gr")
            .doesNotContain("vasilis@clinic.gr")
            .contains("[email:");
    }

    @Test
    void shouldReplaceClinicalTextWithItsLength_notATokenAndNotTheContent() {
        // Given
        String note = "Ασθενής αναφέρει δυσκολία με το πρωινό και άγχος στη δουλειά";
        String body = "{\"content\":\"%s\",\"notes\":\"\"}".formatted(note);

        // When
        String masked = masker.mask(body);

        // Then — whether a field was empty or huge is the usual debugging question;
        // what it said is the part that must not appear
        assertThat(masked)
            .doesNotContain("δυσκολία")
            .doesNotContain("άγχος")
            .contains("[text:" + note.length() + " chars]")
            .contains("[text:0 chars]");
    }

    @Test
    void shouldMaskPhoneNumbersAndDatesOfBirth() {
        // Given — quasi-identifiers, not directly a name but enough to single somebody out
        String body = "{\"phone\":\"6941234567\",\"dateOfBirth\":\"1984-03-11\"}";

        // When
        String masked = masker.mask(body);

        // Then
        assertThat(masked)
            .doesNotContain("6941234567")
            .doesNotContain("1984-03-11")
            .contains("[phone:")
            .contains("[dob:");
    }

    @Test
    void shouldLeaveClinicalMeasurementsReadable_becauseTheyAreWhatDebuggingNeeds() {
        // Given — the numbers are the reason to log a body at all, and alone they identify nobody
        String body = "{\"typeCode\":\"WEIGHT\",\"value\":77.9,\"recordedOn\":\"2026-08-01\"}";

        // When / Then
        assertThat(masker.mask(body)).isEqualTo(body);
    }

    @Test
    void shouldLeaveFoodNamesAlone_sinceTheyAreCatalogueDataAndNotPeople() {
        // Given
        String body = "{\"nameEl\":\"Γραβιέρα Νάξου\",\"nameEn\":\"Graviera\",\"energyKcal\":390}";

        // When / Then — masking these would make the food catalogue undebuggable for no gain
        assertThat(masker.mask(body)).isEqualTo(body);
    }

    @Test
    void shouldNotBeReversibleAcrossRestarts_becauseTheSaltIsPerProcess() {
        // Given — a fresh instance stands in for a restarted process
        String fromThisProcess = masker.mask("{\"fullName\":\"Ελένη\"}");
        String fromAnother = new SensitiveDataMasker().mask("{\"fullName\":\"Ελένη\"}");

        // Then — yesterday's logs cannot be linked to today's, and a stolen log cannot be
        // attacked by hashing a list of common names
        assertThat(fromThisProcess).isNotEqualTo(fromAnother);
    }

    @Test
    void shouldNotOverflowTheStack_onALargeBody() {
        // Given — a body far bigger than anything the application returns. The first version of
        // the field pattern recursed once per character and threw StackOverflowError at a few
        // thousand, which in a filter reading request bodies is a denial of service anyone able
        // to post a large payload could trigger.
        String body = "{\"data\":\"" + "x".repeat(500_000) + "\",\"fullName\":\"Ελένη\"}";

        // When
        String masked = masker.mask(body);

        // Then — it completes, and still masks
        assertThat(masked).doesNotContain("Ελένη");
        assertThat(masked).contains("[id:");
    }

    @Test
    void shouldNotOverflowTheStack_onManyEscapedQuotes() {
        // Given — escapes are the branch of the pattern that backtracks hardest
        String body = "{\"data\":\"" + "\\\"a".repeat(20_000) + "\"}";

        // When / Then
        assertThat(masker.mask(body)).isNotNull();
    }

    @Test
    void shouldCopeWithAwkwardInput_ratherThanThrowing() {
        // Given / When / Then
        assertThat(masker.mask(null)).isNull();
        assertThat(masker.mask("")).isEmpty();
        assertThat(masker.mask("not json at all")).isEqualTo("not json at all");
        assertThat(masker.mask("{\"fullName\":\"\"}")).contains("[id:");
        assertThat(masker.mask("{\"fullName\":\"Ελένη \\\"Η\\\" Δ.\"}")).doesNotContain("Ελένη");
    }

    @Test
    void shouldMaskEveryOccurrence_whenAListOfClientsIsReturned() {
        // Given — a list response, which is where a single miss leaks the whole practice
        String body = """
            {"content":[{"id":1,"fullName":"Ελένη Δ.","email":"a@b.gr"},\
            {"id":2,"fullName":"Γιώργος Π.","email":"c@d.gr"}]}""";

        // When
        String masked = masker.mask(body);

        // Then
        assertThat(masked)
            .doesNotContain("Ελένη")
            .doesNotContain("Γιώργος")
            .doesNotContain("a@b.gr")
            .doesNotContain("c@d.gr");
        assertThat(masked).contains("\"id\":1").contains("\"id\":2");
    }
}
