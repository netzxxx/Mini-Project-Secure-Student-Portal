package kz.narxoz.portal.web;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import kz.narxoz.portal.domain.AuditLog;
import kz.narxoz.portal.domain.User;
import kz.narxoz.portal.repo.UserRepository;
import kz.narxoz.portal.service.AuditService;
import kz.narxoz.portal.service.CurrentUserService;
import kz.narxoz.portal.web.dto.Requests;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

/**
 * Admin-only functions.
 * FIX (Test 2): the ADMIN role is checked on the server twice - in the security
 * filter chain (/api/admin/**) and here with @PreAuthorize (defense in depth),
 * so the check stays even if someone changes the URL rules later.
 */
@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {

    private final UserRepository users;
    private final AuditService audit;
    private final CurrentUserService current;

    public AdminController(UserRepository users, AuditService audit, CurrentUserService current) {
        this.users = users;
        this.audit = audit;
        this.current = current;
    }

    @GetMapping("/users")
    public List<User> allUsers() {
        return users.findAll();
    }

    @PutMapping("/users/{id}/role")
    @Transactional
    public User changeRole(@PathVariable Long id, @Valid @RequestBody Requests.RoleChange req,
                           HttpServletRequest http) {
        User target = users.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        target.setRole(req.role());
        audit.log(current.get().getUsername(), "CHANGE_ROLE " + target.getUsername() + " -> " + req.role(),
                "SUCCESS", http);
        return users.save(target);
    }

    @GetMapping("/audit")
    public List<AuditLog> auditLog() {
        return audit.latest();
    }
}
