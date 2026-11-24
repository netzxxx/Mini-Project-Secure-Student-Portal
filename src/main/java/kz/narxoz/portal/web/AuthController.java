package kz.narxoz.portal.web;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import kz.narxoz.portal.domain.User;
import kz.narxoz.portal.repo.UserRepository;
import kz.narxoz.portal.service.AuditService;
import kz.narxoz.portal.service.TokenService;
import kz.narxoz.portal.web.dto.Requests;
import kz.narxoz.portal.web.dto.UserDtos;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.Optional;

@RestController
public class AuthController {

    private final UserRepository users;
    private final PasswordEncoder encoder;
    private final TokenService tokens;
    private final AuditService audit;

    public AuthController(UserRepository users, PasswordEncoder encoder,
                          TokenService tokens, AuditService audit) {
        this.users = users;
        this.encoder = encoder;
        this.tokens = tokens;
        this.audit = audit;
    }

    @PostMapping("/api/auth/login")
    public ResponseEntity<?> login(@Valid @RequestBody Requests.Login req, HttpServletRequest http) {
        // VULNERABLE (Test 5): no limit on failed attempts, so passwords can be brute-forced.
        Optional<User> found = users.findByUsername(req.username());
        if (found.isEmpty() || !encoder.matches(req.password(), found.get().getPasswordHash())) {
            audit.log(req.username(), "LOGIN", "FAILED", http);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Invalid username or password"));
        }
        User user = found.get();
        audit.log(user.getUsername(), "LOGIN", "SUCCESS", http);
        // FIX (Test 3): only a profile DTO is returned (no passwordHash, no IIN).
        return ResponseEntity.ok(Map.of("token", tokens.issue(user), "user", UserDtos.Profile.from(user)));
    }
}
