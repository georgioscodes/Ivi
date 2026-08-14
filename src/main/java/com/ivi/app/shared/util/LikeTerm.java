package com.ivi.app.shared.util;

/**
 * Escapes a user-typed term so it is matched literally by SQL {@code LIKE}.
 *
 * <p>A term is a bound parameter, so this is not about injection — it is about a search box that
 * silently means something other than what was typed. Concatenated into a pattern, a {@code %} in
 * the term is a wildcard: searching for it returns every row, and an underscore quietly matches
 * any single character. Spring Data's derived {@code Containing} keywords escape this; a
 * hand-written {@code CONCAT('%', :term, '%')} does not.
 *
 * <p>Queries using this must declare {@code ESCAPE '\'}, or the backslashes added here are matched
 * literally instead of doing their job.
 */
public final class LikeTerm {

    private LikeTerm() {
        // Utility class — no instantiation
    }

    public static String escape(String term) {
        if (term == null) {
            return "";
        }
        // The backslash first, or the escapes added below would themselves be escaped.
        return term.replace("\\", "\\\\")
            .replace("%", "\\%")
            .replace("_", "\\_");
    }
}
