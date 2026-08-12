package com.ivi.app.shared.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.repository.NoRepositoryBean;
import org.springframework.data.repository.Repository;

import java.util.Optional;

/**
 * Base repository for entities owned by a practitioner.
 *
 * <p>Tenant-owned repositories extend this instead of {@code JpaRepository}. That is deliberate
 * and is the whole point of the type: {@code JpaRepository} publishes {@code findById},
 * {@code findAll} and {@code deleteById}, none of which take a tenant, so a single forgetful call
 * would read or delete another practitioner's data. Those methods are simply absent here.
 *
 * <p>Isolation therefore rests on the type system rather than on reviewer vigilance — an unscoped
 * lookup is a compile error, not a code-review comment. {@code ArchitectureTest} additionally
 * forbids tenant-owned repositories from extending {@code JpaRepository} directly, closing the
 * only route around it.
 *
 * @param <T>  entity type, which must expose {@code id} and {@code practitionerId} properties
 * @param <ID> identifier type
 */
@NoRepositoryBean
public interface TenantScopedRepository<T, ID> extends Repository<T, ID> {

    <S extends T> S save(S entity);

    Optional<T> findByIdAndPractitionerId(ID id, Long practitionerId);

    Page<T> findAllByPractitionerId(Long practitionerId, Pageable pageable);

    boolean existsByIdAndPractitionerId(ID id, Long practitionerId);

    long countByPractitionerId(Long practitionerId);

    void delete(T entity);
}
