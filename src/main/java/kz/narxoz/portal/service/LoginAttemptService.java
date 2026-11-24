package kz.narxoz.portal.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * FIX (Test 5): brute-force protection.
 * After {@code maxAttempts} wrong passwords for one username, that username is
 * locked for {@code lockDuration}; the login API then answers 429.
 * State is in memory (fine for one demo instance; a real system would use Redis or the DB).
 */
@Service
public class LoginAttemptService {

    private record Attempts(int failures, Instant lockedUntil) {
    }

    private final Map<String, Attempts> attempts = new ConcurrentHashMap<>();
    private final int maxAttempts;
    private final Duration lockDuration;

    public LoginAttemptService(@Value("${app.login.max-attempts:5}") int maxAttempts,
                               @Value("${app.login.lock-seconds:300}") long lockSeconds) {
        this.maxAttempts = maxAttempts;
        this.lockDuration = Duration.ofSeconds(lockSeconds);
    }

    /** Seconds until the account is unlocked, or 0 if it is not locked. */
    public long secondsLocked(String username) {
        Attempts a = attempts.get(key(username));
        if (a == null || a.lockedUntil() == null) {
            return 0;
        }
        long left = Duration.between(Instant.now(), a.lockedUntil()).toSeconds();
        if (left <= 0) {
            attempts.remove(key(username));
            return 0;
        }
        return left;
    }

    public void failed(String username) {
        attempts.compute(key(username), (k, a) -> {
            int failures = (a == null ? 0 : a.failures()) + 1;
            Instant lock = failures >= maxAttempts ? Instant.now().plus(lockDuration) : null;
            return new Attempts(failures, lock);
        });
    }

    public void succeeded(String username) {
        attempts.remove(key(username));
    }

    private static String key(String username) {
        return username.trim().toLowerCase(Locale.ROOT);
    }
}
