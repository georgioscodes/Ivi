# Bundled fonts

`DejaVuSans.ttf` and `DejaVuSans-Bold.ttf`, vendored deliberately rather than relied upon from
the host.

**Why they are here.** The PDF base-14 fonts do not cover Greek. A plan rendered with them shows
blank glyphs or mojibake in the document handed to the client, and nothing fails loudly — the
render succeeds and the defect is found in production. Container images cannot be assumed to carry
system fonts either, so the font ships with the application.

**Why DejaVu.** Verified full coverage of the Greek block, including the accented and dialytika
forms Greek actually uses: no missing glyphs across the 67 characters exercised by
`PlanPdfGreekTest`.

**Licence.** Permissive, allowing redistribution provided the notice accompanies the font. See
`LICENSE-DejaVu.txt`, copied verbatim from the upstream package.
