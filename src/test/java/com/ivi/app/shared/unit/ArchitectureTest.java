package com.ivi.app.shared.unit;

import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;

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

    @ArchTest
    static final ArchRule dtos_are_records =
        classes()
            .that().resideInAPackage("..dto..")
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

    @ArchTest
    static final ArchRule mappers_are_final =
        classes()
            .that().resideInAPackage("..mapper..")
            .should().haveModifier(com.tngtech.archunit.core.domain.JavaModifier.FINAL)
            .because("mappers are static utility classes and are never instantiated or extended")
            .allowEmptyShould(true);
}
