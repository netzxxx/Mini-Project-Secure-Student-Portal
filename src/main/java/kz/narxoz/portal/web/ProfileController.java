package kz.narxoz.portal.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import kz.narxoz.portal.domain.User;
import kz.narxoz.portal.repo.UserRepository;
import kz.narxoz.portal.service.AuditService;
import kz.narxoz.portal.service.CurrentUserService;
import org.springframework.http.MediaType;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;

/** The logged-in user's own profile. */
@RestController
public class ProfileController {

    private final CurrentUserService current;
    private final UserRepository users;
    private final ObjectMapper objectMapper;
    private final AuditService audit;

    public ProfileController(CurrentUserService current, UserRepository users,
                             ObjectMapper objectMapper, AuditService audit) {
        this.current = current;
        this.users = users;
        this.objectMapper = objectMapper;
        this.audit = audit;
    }

    @GetMapping("/api/me")
    public User me() {
        // VULNERABLE (Test 3): returns the entity, so passwordHash and IIN reach the browser.
        return current.get();
    }

    @PatchMapping(value = "/api/me", consumes = MediaType.APPLICATION_JSON_VALUE)
    @Transactional
    public User updateMe(@RequestBody String body, HttpServletRequest http) throws IOException {
        User me = current.get();
        // VULNERABLE (Test 4): mass assignment. Every JSON field is copied onto the entity,
        // so a student can send {"role":"ADMIN"} and promote themselves.
        objectMapper.readerForUpdating(me).readValue(body);
        User saved = users.save(me);
        audit.log(saved.getUsername(), "PROFILE_UPDATE", "SUCCESS", http);
        return saved;
    }
}
