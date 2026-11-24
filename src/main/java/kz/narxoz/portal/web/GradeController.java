package kz.narxoz.portal.web;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import kz.narxoz.portal.domain.Grade;
import kz.narxoz.portal.domain.Role;
import kz.narxoz.portal.domain.User;
import kz.narxoz.portal.repo.GradeRepository;
import kz.narxoz.portal.service.AuditService;
import kz.narxoz.portal.service.CurrentUserService;
import kz.narxoz.portal.web.dto.GradeDto;
import kz.narxoz.portal.web.dto.Requests;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;

@RestController
public class GradeController {

    private final GradeRepository grades;
    private final CurrentUserService current;
    private final AuditService audit;

    public GradeController(GradeRepository grades, CurrentUserService current, AuditService audit) {
        this.grades = grades;
        this.current = current;
        this.audit = audit;
    }

    /** Grades of one student. The frontend calls it with the logged-in student's own id. */
    @GetMapping("/api/students/{studentId}/grades")
    @Transactional(readOnly = true)
    public List<GradeDto> studentGrades(@PathVariable Long studentId, HttpServletRequest http) {
        // FIX (Test 1): object-level authorization. The id from the URL is checked
        // against the logged-in user on the server:
        //   STUDENT -> only their own id
        //   TEACHER -> only grades in courses they teach
        //   ADMIN   -> everything
        User me = current.get();
        List<Grade> list = grades.findByStudentId(studentId);

        if (me.getRole() == Role.TEACHER) {
            list = list.stream()
                    .filter(g -> g.getCourse().getTeacher().getId().equals(me.getId()))
                    .toList();
        }
        boolean allowed = switch (me.getRole()) {
            case STUDENT -> me.getId().equals(studentId);
            case TEACHER -> !list.isEmpty();
            case ADMIN -> true;
        };
        if (!allowed) {
            audit.log(me.getUsername(), "READ_GRADES student=" + studentId, "DENIED", http);
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }
        return list.stream().map(GradeDto::from).toList();
    }

    /** Teacher updates a grade in one of their own courses (admin may update any). */
    @PutMapping("/api/grades/{gradeId}")
    @Transactional
    public GradeDto update(@PathVariable Long gradeId, @Valid @RequestBody Requests.GradeUpdate req,
                           HttpServletRequest http) {
        User me = current.get();
        Grade g = grades.findById(gradeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        boolean ownsCourse = me.getRole() == Role.TEACHER
                && g.getCourse().getTeacher().getId().equals(me.getId());
        if (!(ownsCourse || me.getRole() == Role.ADMIN)) {
            audit.log(me.getUsername(), "UPDATE_GRADE " + gradeId, "DENIED", http);
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }
        g.setMidterm(req.midterm());
        g.setFinalExam(req.finalExam());
        g.setTeacherComment(req.teacherComment());
        g.setUpdatedAt(Instant.now());
        audit.log(me.getUsername(), "UPDATE_GRADE " + gradeId, "SUCCESS", http);
        return GradeDto.from(grades.save(g));
    }
}
