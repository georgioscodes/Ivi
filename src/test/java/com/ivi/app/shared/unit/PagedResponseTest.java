package com.ivi.app.shared.unit;

import com.ivi.app.shared.dto.PagedResponse;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class PagedResponseTest {

    @Test
    void shouldCarryPageMetadata_whenBuiltFromAPage() {
        // Given
        Page<String> page = new PageImpl<>(List.of("a", "b"), PageRequest.of(0, 2), 5);

        // When
        PagedResponse<String> response = PagedResponse.from(page);

        // Then
        assertThat(response.content()).containsExactly("a", "b");
        assertThat(response.page()).isZero();
        assertThat(response.size()).isEqualTo(2);
        assertThat(response.totalElements()).isEqualTo(5);
        assertThat(response.totalPages()).isEqualTo(3);
        assertThat(response.last()).isFalse();
    }

    @Test
    void shouldReportLast_whenOnTheFinalPage() {
        // Given
        Page<String> page = new PageImpl<>(List.of("e"), PageRequest.of(2, 2), 5);

        // When
        PagedResponse<String> response = PagedResponse.from(page);

        // Then
        assertThat(response.last()).isTrue();
        assertThat(response.page()).isEqualTo(2);
    }

    @Test
    void shouldBeEmptyAndLast_whenThePageHasNoContent() {
        // Given
        Page<String> page = Page.empty(PageRequest.of(0, 20));

        // When
        PagedResponse<String> response = PagedResponse.from(page);

        // Then
        assertThat(response.content()).isEmpty();
        assertThat(response.totalElements()).isZero();
        assertThat(response.last()).isTrue();
    }
}
