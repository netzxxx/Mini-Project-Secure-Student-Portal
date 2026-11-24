package kz.narxoz.portal.web;

import kz.narxoz.portal.domain.User;
import kz.narxoz.portal.repo.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** Contact card of a user (used by teachers to see a student's contacts). */
@RestController
public class UserController {

    private final UserRepository users;

    public UserController(UserRepository users) {
        this.users = users;
    }

    @GetMapping("/api/users/{id}")
    public User user(@PathVariable Long id) {
        // VULNERABLE (Test 3): any logged-in user gets the full entity of any user,
        // including passwordHash, IIN and phone.
        return users.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }
}
