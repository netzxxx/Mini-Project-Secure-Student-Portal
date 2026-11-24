package kz.narxoz.portal.web;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import kz.narxoz.portal.domain.User;
import kz.narxoz.portal.repo.UserRepository;
import kz.narxoz.portal.service.AuditService;
import kz.narxoz.portal.service.LoginAttemptService;
import kz.narxoz.portal.service.TokenService;
import kz.narxoz.portal.web.dto.Requests;
import kz.narxoz.portal.web.dto.UserDtos;
import org.springframework.http.HttpHeaders;
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
    private final LoginAttemptService loginAttempts;
    /** BCrypt hash of a random value, used so unknown usernames take as long as known ones. */
    private final String dummyHash;

    public AuthController(UserRepository users, PasswordEncoder encoder, TokenService tokens,
                          AuditService audit, LoginAttemptService loginAttempts) {
        this.users = users;
        this.encoder = encoder;
        this.tokens = tokens;
        this.audit = audit;
        this.loginAttempts = loginAttempts;
        this.dummyHash = encoder.encode("timing-equalizer");
    }

    @PostMapping("/api/auth/login")
    public ResponseEntity<?> login(@Valid @RequestBody Requests.Login req, HttpServletRequest http) {
        // FIX (Test 5): locked accounts are refused before the password is even checked.
        long locked = loginAttempts.secondsLocked(req.username());
        if (locked > 0) {
            audit.log(req.username(), "LOGIN", "LOCKED", http);
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .header(HttpHeaders.RETRY_AFTER, String.valueOf(locked))
                    .body(Map.of("error", "Too many failed attempts. Try again later."));
        }

        Optional<User> found = users.findByUsername(req.username());
        // same BCrypt work for unknown users -> response time does not reveal valid usernames
        boolean ok = encoder.matches(req.password(), found.map(User::getPasswordHash).orElse(dummyHash))
                && found.isPresent();
        if (!ok) {
            loginAttempts.failed(req.username());
            audit.log(req.username(), "LOGIN", "FAILED", http);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Invalid username or password"));
        }

        User user = found.get();
        loginAttempts.succeeded(user.getUsername());
        audit.log(user.getUsername(), "LOGIN", "SUCCESS", http);
        // FIX (Test 3): only a profile DTO is returned (no passwordHash, no IIN).
        return ResponseEntity.ok(Map.of("token", tokens.issue(user), "user", UserDtos.Profile.from(user)));
    }
}
