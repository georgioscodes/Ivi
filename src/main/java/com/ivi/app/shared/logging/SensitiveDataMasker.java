package com.ivi.app.shared.logging;

import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.HexFormat;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Masks personal data in request and response bodies before they reach a log.
 *
 * <p>Four categories, treated differently because they carry different risk and different
 * debugging value:
 *
 * <ul>
 *   <li><strong>Credentials</strong> are replaced outright. There is no version of a password
 *       that is useful in a log.</li>
 *   <li><strong>Identifiers</strong> — names, emails, phone numbers, dates of birth — become a
 *       short token derived from the value. Two log lines about the same person carry the same
 *       token, so a request can still be followed through the system, but the token does not say
 *       who they are.</li>
 *   <li><strong>Free clinical text</strong> — notes, journal content, goals — is replaced by its
 *       length. Whether a field was empty or enormous is usually the debugging question; what it
 *       said is the part that must not be logged.</li>
 *   <li><strong>Anything email-shaped</strong> is masked wherever it appears, including inside
 *       text that no key marked as sensitive, because addresses turn up in free text.</li>
 * </ul>
 *
 * <p>The token salt is random per process. That is deliberate: a bare hash of a name is
 * reversible by anyone who can guess names, which is not a large search space. A per-process
 * salt keeps correlation useful within a run while making the tokens meaningless to anyone
 * holding yesterday's logs, and unlinkable across restarts.
 */
@Component
public class SensitiveDataMasker {

    /** No form of these is useful in a log. */
    private static final Set<String> CREDENTIAL_KEYS = Set.of(
        "password", "newpassword", "currentpassword", "oldpassword", "passwordconfirmation",
        "token", "accesstoken", "refreshtoken", "secret", "clientsecret",
        "credential", "credentials", "otp", "pin", "apikey");

    /** Direct identifiers: masked to a stable token so requests stay traceable. */
    private static final Set<String> IDENTITY_KEYS = Set.of(
        "fullname", "displayname", "practicename", "firstname", "lastname",
        "email", "phone", "mobile", "telephone", "dateofbirth", "taxid", "amka");

    /**
     * Free clinical text. Replaced by a length rather than a token, because unlike a name these
     * are not identifiers to be correlated — they are the content itself.
     */
    private static final Set<String> FREE_TEXT_KEYS = Set.of(
        "notes", "content", "goal", "rationale", "comment", "description");

    /**
     * Matches a JSON string field.
     *
     * <p>Written as an unrolled loop with possessive quantifiers, not the more obvious
     * {@code (?:[^"\\]|\\.)*}. That form recurses once per character in Java's regex engine and
     * overflows the stack on a few thousand characters — which, in a filter that reads request
     * bodies, is a denial of service reachable by anyone who can post a large payload.
     */
    private static final Pattern JSON_FIELD = Pattern.compile(
        "\"([a-zA-Z0-9_]++)\"\\s*+:\\s*+\"([^\"\\\\]*+(?:\\\\.[^\"\\\\]*+)*+)\"");

    /**
     * Deliberately loose about what counts as an address — over-masking one is harmless, missing
     * one is not — but strictly bounded in length.
     *
     * <p>The unbounded {@code +} this replaces was quadratic: on a long run of matching characters
     * containing no {@code @}, the engine consumed the whole run at every starting position.
     * Masking a 100 kB body took 54 seconds, which in a filter that reads request bodies is a
     * denial of service anyone able to post a large payload could trigger. The bounds reflect the
     * real limits of an address and make the scan linear.
     */
    private static final Pattern EMAIL_LIKE = Pattern.compile(
        "[A-Za-z0-9._%+-]{1,64}+@(?:[A-Za-z0-9-]{1,63}+\\.){1,8}+[A-Za-z]{2,24}+");

    private final byte[] salt = new byte[16];

    public SensitiveDataMasker() {
        new SecureRandom().nextBytes(salt);
    }

    public String mask(String body) {
        if (body == null || body.isEmpty()) {
            return body;
        }

        Matcher matcher = JSON_FIELD.matcher(body);
        StringBuilder masked = new StringBuilder();

        while (matcher.find()) {
            String key = matcher.group(1);
            String value = matcher.group(2);
            matcher.appendReplacement(masked,
                Matcher.quoteReplacement("\"" + key + "\":\"" + maskValue(key, value) + "\""));
        }
        matcher.appendTail(masked);

        // Catches addresses in values that no sensitive key covered, and in non-JSON payloads.
        return EMAIL_LIKE.matcher(masked.toString())
            .replaceAll(match -> "[email:" + token(match.group()) + "]");
    }

    private String maskValue(String key, String value) {
        String normalised = key.toLowerCase();

        if (CREDENTIAL_KEYS.contains(normalised)) {
            return "[REDACTED]";
        }
        if (IDENTITY_KEYS.contains(normalised)) {
            return "[" + labelFor(normalised) + ":" + token(value) + "]";
        }
        if (FREE_TEXT_KEYS.contains(normalised)) {
            return "[text:" + value.length() + " chars]";
        }
        return value;
    }

    private String labelFor(String key) {
        if (key.contains("mail")) {
            return "email";
        }
        if (key.contains("phone") || key.contains("mobile") || key.contains("telephone")) {
            return "phone";
        }
        if (key.contains("birth")) {
            return "dob";
        }
        return "id";
    }

    /**
     * Four hex characters of a salted digest. Short on purpose: a log line stays readable, and
     * the collisions that shortness allows are acceptable when the point is correlation rather
     * than identification.
     */
    private String token(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            digest.update(salt);
            byte[] hash = digest.digest(value.trim().toLowerCase().getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash, 0, 2);
        } catch (NoSuchAlgorithmException ex) {
            // SHA-256 is required of every JVM, so this cannot happen — but failing closed
            // matters more than being clever if it somehow does.
            return "masked";
        }
    }
}
