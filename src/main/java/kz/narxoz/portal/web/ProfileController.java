package kz.narxoz.portal.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import kz.narxoz.portal.domain.User;
import kz.narxoz.portal.repo.UserRepository;
import kz.narxoz.portal.service.AuditService;
import kz.narxoz.portal.service.CurrentUserService;
import kz.narxoz.portal.web.dto.Requests;
import kz.narxoz.portal.web.dto.UserDtos;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.Set;
import java.util.TreeSet;

/** The logged-in user's own profile. */
@RestController
public class ProfileController {

    /** FIX (Test 4): whitelist of fields a user may edit on their own profile. */
    private static final Set<String> EDITABLE_FIELDS = Set.of("fullName", "email", "phone");

    private final CurrentUserService current;
    private final UserRepository users;
    private final ObjectMapper objectMapper;
    private final Validator validator;
    private final AuditService audit;

    public ProfileController(CurrentUserService current, UserRepository users, ObjectMapper objectMapper,
                             Validator validator, AuditService audit) {
        this.current = current;
        this.users = users;
        this.objectMapper = objectMapper;
        this.validator = validator;
        this.audit = audit;
    }

    @GetMapping("/api/me")
    public UserDtos.Profile me() {
        // FIX (Test 3): DTO instead of the entity.
        return UserDtos.Profile.from(current.get());
    }

    @PatchMapping(value = "/api/me", consumes = MediaType.APPLICATION_JSON_VALUE)
    @Transactional
    public ResponseEntity<?> updateMe(@RequestBody Map<String, Object> body, HttpServletRequest http) {
        User me = current.get();

        // FIX (Test 4): mass assignment. Any field outside the whitelist (role, id,
        // passwordHash, username, ...) rejects the whole request with 400.
        Set<String> rejected = new TreeSet<>(body.keySet());
        rejected.removeAll(EDITABLE_FIELDS);
        if (!rejected.isEmpty()) {
            audit.log(me.getUsername(), "PROFILE_UPDATE fields=" + rejected, "DENIED", http);
            return ResponseEntity.badRequest().body(Map.of("error", "Field(s) not allowed", "fields", rejected));
        }

        Requests.ProfileUpdate req = objectMapper.convertValue(body, Requests.ProfileUpdate.class);
        Set<ConstraintViolation<Requests.ProfileUpdate>> violations = validator.validate(req);
        if (!violations.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid value",
                    "fields", violations.stream().map(v -> v.getPropertyPath().toString()).sorted().toList()));
        }

        // Only the three allowed fields are copied - explicitly, one by one.
        me.setFullName(req.fullName());
        me.setEmail(req.email());
        me.setPhone(req.phone());
        User saved = users.save(me);
        audit.log(saved.getUsername(), "PROFILE_UPDATE", "SUCCESS", http);
        return ResponseEntity.ok(UserDtos.Profile.from(saved));
    }
}
