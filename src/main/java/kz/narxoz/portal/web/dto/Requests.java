package kz.narxoz.portal.web.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
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

    /** FIX (Test 4): the only profile fields a user may change themselves. */
    public record ProfileUpdate(@NotBlank @Size(max = 80) String fullName,
                                @Email @Size(max = 80) String email,
                                @Pattern(regexp = "^[0-9 +()-]{0,20}$") String phone) {
    }
}
