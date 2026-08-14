package com.ivi.app.shared.unit;

import com.ivi.app.shared.util.GreekText;
import java.util.Locale;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Folding Greek for search.
 *
 * <p>Measured against the running server before any of this existed: two journal entries both
 * containing the word "διατροφή" — one in ordinary lowercase, one in a capitalised heading — and
 * <em>no</em> search term found both. Every query found exactly one of them. Capitals carry no
 * accents in Greek, so lowercasing a heading gives "διατροφη" and the accented word never matches.
 */
class GreekTextTest {

    @ParameterizedTest(name = "{0} and {1} fold together")
    @CsvSource({
        // The pair that started this: the same word, written the two ways it is actually written.
        "ΔΙΑΤΡΟΦΗ, διατροφή",
        "ΠΡΟΣΟΧΗ, προσοχή",
        "ΣΗΜΑΝΤΙΚΟ, σημαντικό",
        // Every accented vowel Greek has.
        "ΑΕΗΙΟΥΩ, άέήίόύώ",
        // Dialytika, with and without a tonos on top of it.
        "ΓΑΙΔΟΥΡΙ, γαϊδούρι",
        "ΠΡΑΥΝΩ, πραΰνω",
    })
    void shouldFoldTheSameWordWrittenTwoWays(String capitals, String lowercase) {
        assertThat(GreekText.fold(capitals)).isEqualTo(GreekText.fold(lowercase));
    }

    @Test
    void shouldUnifyFinalSigmaWithMedialSigma() {
        // Given — "διατροφής" ends in ς, and the same stem inside a longer word does not. A
        // practitioner searching for part of a word should not have to know which they typed.
        assertThat(GreekText.fold("διατροφής")).isEqualTo("διατροφησ");
        assertThat(GreekText.fold("ΔΙΑΤΡΟΦΗΣ")).isEqualTo("διατροφησ");
    }

    @Test
    void shouldLeaveLatinTextComparableToo() {
        // Given — food names and the odd English note live in the same field
        assertThat(GreekText.fold("Protein WAS low")).isEqualTo("protein was low");
    }

    @Test
    void shouldNotUseTheDefaultLocale() {
        // Given — under a Turkish locale `toLowerCase` maps I to a dotless ı, which would change
        // how Latin text compares depending on where the server happens to be running.
        Locale original = Locale.getDefault();
        try {
            Locale.setDefault(Locale.forLanguageTag("tr-TR"));
            assertThat(GreekText.fold("INTAKE")).isEqualTo("intake");
        } finally {
            Locale.setDefault(original);
        }
    }

    @Test
    void shouldFoldNullToEmptyRatherThanThrowing() {
        // Given — a title is nullable, and folding is applied to whatever is there
        assertThat(GreekText.fold(null)).isEmpty();
    }

    @Test
    void shouldLeaveTextWithNothingToFoldAlone() {
        assertThat(GreekText.fold("απλο κειμενο")).isEqualTo("απλο κειμενο");
    }
}
