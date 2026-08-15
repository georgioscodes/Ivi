package com.ivi.app.journal.repository;

import com.ivi.app.journal.model.JournalEntryEntity;
import com.ivi.app.shared.repository.TenantScopedRepository;
import com.ivi.app.shared.util.GreekText;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Journal entries are tenant-owned, so this extends TenantScopedRepository and gets no
 * unscoped finder.
 */
public interface JournalEntryRepository extends TenantScopedRepository<JournalEntryEntity, Long> {

    /**
     * The {@code translate()} arguments that fold Greek for comparison, taken from
     * {@link GreekText} rather than written out here.
     *
     * <p>They are compile-time constants precisely so they can be concatenated into an annotation:
     * the term is folded in Java and the stored text in SQL, and the two must fold identically or
     * every search quietly returns nothing. One definition, used by both.
     *
     * <p>Concatenation rather than a text block because a text block cannot interpolate — written
     * as one, the constant names end up in the query as literal characters.
     */
    String FOLD = "'" + GreekText.ACCENTED + "', '" + GreekText.FOLDED + "'";

    /** The folded haystack: the title and the content together, so both are searchable. */
    String FOLDED_TEXT =
        "translate(lower(coalesce(j.title, '') || ' ' || j.content), " + FOLD + ")";

    String MATCHES = " AND " + FOLDED_TEXT + " LIKE CONCAT('%', :term, '%') ESCAPE '\\' ";

    String SCOPE = "FROM journal_entry j"
        + " WHERE j.practitioner_id = :practitionerId AND j.client_id = :clientId";

    /**
     * A client's entries, newest first.
     *
     * <p>The tie-break on id is not decoration. Entry dates repeat — two consultations in a day,
     * or a batch written up for the same date — and {@code ORDER BY entry_date DESC} alone leaves
     * their order to the database. Across a paged read that is a correctness problem rather than a
     * cosmetic one: an unstable sort can show the same entry on two pages and omit another
     * entirely.
     */
    @Query("""
        SELECT j FROM JournalEntryEntity j
        WHERE j.practitionerId = :practitionerId AND j.clientId = :clientId
        ORDER BY j.entryDate DESC, j.id DESC
        """)
    Page<JournalEntryEntity> findForClient(@Param("practitionerId") Long practitionerId,
                                           @Param("clientId") Long clientId,
                                           Pageable pageable);

    /**
     * A client's entries matching a term, newest first.
     *
     * <p>Native rather than JPQL because the folding is a SQL expression: {@code lower()} alone
     * cannot match Greek written in capitals against the same word written in lowercase, since
     * capitals carry no accents.
     *
     * <p>The title is searched as well as the content. It was not before, so an entry a
     * practitioner had titled "Επανέλεγχος" could not be found by searching for that word.
     *
     * <p>No index helps a {@code LIKE '%term%'}, and none did before either. Entries are scoped to
     * one client first, which is a few dozen rows; a trigram index is the answer if that ever
     * stops being true.
     */
    @Query(nativeQuery = true,
        value = "SELECT * " + SCOPE + MATCHES + " ORDER BY j.entry_date DESC, j.id DESC",
        countQuery = "SELECT count(*) " + SCOPE + MATCHES)
    Page<JournalEntryEntity> search(@Param("practitionerId") Long practitionerId,
                                    @Param("clientId") Long clientId,
                                    @Param("term") String foldedTerm,
                                    Pageable pageable);
}
