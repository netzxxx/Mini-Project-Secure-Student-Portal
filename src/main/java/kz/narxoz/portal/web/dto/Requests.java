package kz.narxoz.portal.web.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import kz.narxoz.portal.domain.Role;

/** Request bodies used by the API. */
public final class Requests {

    private Requests() {
    }

    public record Login(@NotBlank @Size(max = 64) String username,
                        @NotBlank @Size(max = 128) String password) {
    }

    public record GradeUpdate(@NotNull @Min(0) @Max(100) Integer midterm,
                              @NotNull @Min(0) @Max(100) Integer finalExam,
                              @Size(max = 200) String teacherComment) {
    }

    public record RoleChange(@NotNull Role role) {
    }
}
