package com.ivi.app.shared.unit;

import com.ivi.app.shared.util.LikeTerm;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * A search box has to mean what was typed.
 *
 * <p>Concatenated into a {@code LIKE} pattern, an unescaped {@code %} matches everything — so
 * typing one returns every entry the practitioner has, which reads as a broken filter rather than
 * as a wildcard they asked for. Measured against the running server: the derived Spring Data
 * finder escaped these, and the hand-written query that replaced it did not.
 */
class LikeTermTest {

    @Test
    void shouldEscapeThePercentWildcard() {
        assertThat(LikeTerm.escape("100%")).isEqualTo("100\\%");
    }

    @Test
    void shouldEscapeTheSingleCharacterWildcard() {
        // Given — underscores turn up in pasted identifiers and file names
        assertThat(LikeTerm.escape("pre_post")).isEqualTo("pre\\_post");
    }

    @Test
    void shouldEscapeTheEscapeCharacterFirst() {
        // Given — escaping the backslash last would escape the backslashes just added, so a term
        // of "\" would come out as a dangling escape and the database would reject the pattern
        assertThat(LikeTerm.escape("\\")).isEqualTo("\\\\");
        assertThat(LikeTerm.escape("\\%")).isEqualTo("\\\\\\%");
    }

    @Test
    void shouldLeaveOrdinaryTextUntouched() {
        assertThat(LikeTerm.escape("διατροφή")).isEqualTo("διατροφή");
    }

    @Test
    void shouldTreatNullAsAnEmptyTerm() {
        assertThat(LikeTerm.escape(null)).isEmpty();
    }
}
