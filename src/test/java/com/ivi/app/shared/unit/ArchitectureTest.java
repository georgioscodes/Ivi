package com.ivi.app.shared.unit;

import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;
import org.springframework.data.jpa.repository.JpaRepository;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

/**
 * Structural rules from the spring-boot-clean-code skill, enforced by the build.
 *
 * These are written before the feature modules exist so that the first module to arrive is
 * already constrained. Every rule allows an empty match set — they are guards for code that
 * is coming, not assertions that it is already here.
 */
@AnalyzeClasses(
    packages = "com.ivi.app",
    importOptions = ImportOption.DoNotIncludeTests.class
)
class ArchitectureTest {

    @ArchTest
    static final ArchRule entities_stay_inside_their_module =
        noClasses()
            .that().resideInAPackage("..model..")
            .should().dependOnClassesThat().resideInAPackage("..controller..")
            .because("entities are an internal persistence detail and must not know about HTTP")
            .allowEmptyShould(true);

    @ArchTest
    static final ArchRule controllers_do_not_touch_repositories =
        noClasses()
            .that().resideInAPackage("..controller..")
            .should().dependOnClassesThat().resideInAPackage("..repository..")
            .because("controllers delegate to services; data access is not their concern")
            .allowEmptyShould(true);

    @ArchTest
    static final ArchRule controllers_do_not_touch_entities =
        noClasses()
            .that().resideInAPackage("..controller..")
            .should().dependOnClassesThat().resideInAPackage("..model..")
            .because("DTOs are the only public contract of a module")
            .allowEmptyShould(true);

    @ArchTest
    static final ArchRule repositories_are_interfaces =
        classes()
            .that().resideInAPackage("..repository..")
            .should().beInterfaces()
            .because("data access is declared through Spring Data interfaces")
            .allowEmptyShould(true);

    /**
     * Enums are excluded. The rule exists to keep mutable POJOs out of the public contract, and
     * an enum is already immutable — {@code BmrEquation} and {@code Sex} are part of the
     * nutrition contract and belong beside the records that carry them.
     */
    @ArchTest
    static final ArchRule dtos_are_records =
        classes()
            .that().resideInAPackage("..dto..")
            .and().areNotEnums()
            .should().beRecords()
            .because("DTOs are immutable record-based contracts")
            .allowEmptyShould(true);

    @ArchTest
    static final ArchRule entities_are_named_entity =
        classes()
            .that().resideInAPackage("..model..")
            .and().areAnnotatedWith("jakarta.persistence.Entity")
            .should().haveSimpleNameEndingWith("Entity")
            .allowEmptyShould(true);

    /**
     * The rule that carries the most weight here.
     *
     * <p>{@code JpaRepository} publishes {@code findById}, {@code findAll} and
     * {@code deleteById} — none of which take a tenant. A tenant-owned repository extending it
     * would expose an unscoped lookup that leaks another practitioner's health records. Such
     * repositories must extend {@code TenantScopedRepository}, which simply has no unscoped
     * finders on it.
     *
     * <p>The practitioner repository is the sole exception: the practitioner <em>is</em> the
     * tenant root, so there is no outer tenant to scope it by.
     */
    @ArchTest
    static final ArchRule tenant_owned_repositories_do_not_extend_jpa_repository =
        noClasses()
            .that().resideInAPackage("..repository..")
            .and().doNotHaveFullyQualifiedName(
                "com.ivi.app.practitioner.repository.PractitionerRepository")
            .and().doNotHaveFullyQualifiedName(
                "com.ivi.app.shared.repository.TenantScopedRepository")
            .should().beAssignableTo(JpaRepository.class)
            .because("tenant-owned repositories must extend TenantScopedRepository, which has no "
                + "unscoped finders, so an unscoped lookup cannot compile")
            .allowEmptyShould(true);

    /**
     * The practitioner repository is reachable from its own module and from the authentication
     * machinery in shared.security, which must load credentials. Nothing else.
     */
    @ArchTest
    static final ArchRule practitioner_repository_has_limited_reach =
        classes()
            .that().haveFullyQualifiedName(
                "com.ivi.app.practitioner.repository.PractitionerRepository")
            .should().onlyHaveDependentClassesThat()
            .resideInAnyPackage("com.ivi.app.practitioner..", "com.ivi.app.shared.security..")
            .allowEmptyShould(true);

    @ArchTest
    static final ArchRule services_do_not_reach_into_other_modules_repositories =
        noClasses()
            .that().resideInAPackage("com.ivi.app.client..")
            .should().dependOnClassesThat()
            .resideInAPackage("com.ivi.app.practitioner.repository..")
            .because("modules talk to each other through services, never through data access")
            .allowEmptyShould(true);

    @ArchTest
    static final ArchRule mappers_are_final =
        classes()
            .that().resideInAPackage("..mapper..")
            .should().haveModifier(com.tngtech.archunit.core.domain.JavaModifier.FINAL)
            .because("mappers are static utility classes and are never instantiated or extended")
            .allowEmptyShould(true);
}
