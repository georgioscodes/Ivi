package com.ivi.app.journal.repository;

import com.ivi.app.journal.model.JournalEntryEntity;
import com.ivi.app.shared.repository.TenantScopedRepository;
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
     * capitals carry no accents. The {@code translate()} arguments are the same pair of strings as
     * {@link com.ivi.app.shared.util.GreekText}, which folds the search term before it is bound —
     * both sides have to fold identically or nothing matches.
     *
     * <p>The title is searched as well as the content. It was not before, so an entry a
     * practitioner had titled "Επανέλεγχος" could not be found by searching for that word.
     *
     * <p>No index helps a {@code LIKE '%term%'}, and none did before either. Entries are scoped to
     * one client first, which is a few dozen rows; a trigram index is the answer if that ever
     * stops being true.
     */
    @Query(nativeQuery = true,
        value = """
            SELECT * FROM journal_entry j
            WHERE j.practitioner_id = :practitionerId
              AND j.client_id = :clientId
              AND translate(lower(coalesce(j.title, '') || ' ' || j.content),
                            'άέήίόύώϊϋΐΰς', 'αεηιουωιυιυσ') LIKE CONCAT('%', :term, '%') ESCAPE '\\'
            ORDER BY j.entry_date DESC, j.id DESC
            """,
        countQuery = """
            SELECT count(*) FROM journal_entry j
            WHERE j.practitioner_id = :practitionerId
              AND j.client_id = :clientId
              AND translate(lower(coalesce(j.title, '') || ' ' || j.content),
                            'άέήίόύώϊϋΐΰς', 'αεηιουωιυιυσ') LIKE CONCAT('%', :term, '%') ESCAPE '\\'
            """)
    Page<JournalEntryEntity> search(@Param("practitionerId") Long practitionerId,
                                    @Param("clientId") Long clientId,
                                    @Param("term") String foldedTerm,
                                    Pageable pageable);
}
