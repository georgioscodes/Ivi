package com.ivi.app.shared.util;

import java.util.Locale;

/**
 * Text folding for Greek search.
 *
 * <p>Case folding alone is not enough for Greek, and the reason is orthographic rather than
 * technical: Greek is written <em>without</em> accents in capitals. A practitioner who types
 * "ΠΡΟΣΟΧΗ" as a heading and later searches for "προσοχή" — spelling the word correctly, with its
 * accent — gets nothing back, because lowercasing the heading yields "προσοχη" and the two strings
 * differ in one character. The same word, written twice, in two forms that never match.
 *
 * <p>That failure is quiet. Search still returns <em>some</em> rows, so it looks like it works
 * right up until the entry a practitioner is certain they wrote cannot be found.
 *
 * <p>So both sides of a comparison are folded: lowercased, stripped of the accents Greek puts on
 * lowercase vowels, and with final sigma unified with medial sigma. The last one matters for the
 * same reason — "διατροφής" ends in ς, and a term typed as part of a longer word does not.
 */
public final class GreekText {

    /**
     * The accented lowercase vowels, plus final sigma, position for position with {@link #FOLDED}.
     *
     * <p>Public and {@code final} so the repositories can concatenate them straight into their
     * {@code translate()} calls — a compile-time constant is usable inside an annotation, which
     * makes this the single definition of the folding for both the Java side (the search term)
     * and the SQL side (the stored text). They were duplicated as literals in two places at first,
     * and the two have to agree exactly or nothing matches: fold the term one way and the column
     * another, and every search silently returns nothing.
     */
    public static final String ACCENTED = "άέήίόύώϊϋΐΰς";
    public static final String FOLDED = "αεηιουωιυιυσ";

    private GreekText() {
        // Utility class — no instantiation
    }

    /**
     * Folds text for comparison. Never returns null; a null input folds to an empty string.
     *
     * <p>{@code Locale.ROOT} rather than the default locale: under a Turkish locale
     * {@code toLowerCase} maps I to a dotless ı, which would quietly change how Latin food names
     * and email addresses compare.
     */
    public static String fold(String value) {
        if (value == null) {
            return "";
        }

        String lowered = value.toLowerCase(Locale.ROOT);
        StringBuilder folded = new StringBuilder(lowered.length());

        for (int i = 0; i < lowered.length(); i++) {
            char c = lowered.charAt(i);
            int index = ACCENTED.indexOf(c);
            folded.append(index < 0 ? c : FOLDED.charAt(index));
        }

        return folded.toString();
    }
}
