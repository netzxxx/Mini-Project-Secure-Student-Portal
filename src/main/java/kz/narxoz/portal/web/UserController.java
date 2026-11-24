package kz.narxoz.portal.web;

import jakarta.servlet.http.HttpServletRequest;
import kz.narxoz.portal.domain.Role;
import kz.narxoz.portal.domain.User;
import kz.narxoz.portal.repo.GradeRepository;
import kz.narxoz.portal.repo.UserRepository;
import kz.narxoz.portal.service.AuditService;
import kz.narxoz.portal.service.CurrentUserService;
import kz.narxoz.portal.web.dto.UserDtos;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** Contact card of a user (used by teachers to see a student's contacts). */
@RestController
public class UserController {

    private final UserRepository users;
    private final GradeRepository grades;
    private final CurrentUserService current;
    private final AuditService audit;

    public UserController(UserRepository users, GradeRepository grades,
                          CurrentUserService current, AuditService audit) {
        this.users = users;
        this.grades = grades;
        this.current = current;
        this.audit = audit;
    }

    @GetMapping("/api/users/{id}")
    @Transactional(readOnly = true)
    public UserDtos.Contact user(@PathVariable Long id, HttpServletRequest http) {
        // FIX (Test 3): only a small contact DTO is returned, and only to
        // the user themselves, an admin, or a teacher of that student.
        User me = current.get();
        boolean allowed = me.getId().equals(id)
                || me.getRole() == Role.ADMIN
                || (me.getRole() == Role.TEACHER && grades.existsByStudentIdAndCourseTeacherId(id, me.getId()));
        if (!allowed) {
            audit.log(me.getUsername(), "READ_USER " + id, "DENIED", http);
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }
        User u = users.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        return UserDtos.Contact.from(u);
    }
}
