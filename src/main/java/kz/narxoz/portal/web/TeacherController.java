package kz.narxoz.portal.web;

import kz.narxoz.portal.domain.Course;
import kz.narxoz.portal.domain.Role;
import kz.narxoz.portal.domain.User;
import kz.narxoz.portal.repo.CourseRepository;
import kz.narxoz.portal.repo.GradeRepository;
import kz.narxoz.portal.service.CurrentUserService;
import kz.narxoz.portal.web.dto.CourseDto;
import kz.narxoz.portal.web.dto.GradeDto;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
public class TeacherController {

    private final CourseRepository courses;
    private final GradeRepository grades;
    private final CurrentUserService current;

    public TeacherController(CourseRepository courses, GradeRepository grades, CurrentUserService current) {
        this.courses = courses;
        this.grades = grades;
        this.current = current;
    }

    /** Courses taught by the logged-in teacher (admin sees all courses). */
    @GetMapping("/api/teacher/courses")
    @Transactional(readOnly = true)
    public List<CourseDto> myCourses() {
        User me = current.get();
        List<Course> list = me.getRole() == Role.ADMIN ? courses.findAll() : courses.findByTeacherId(me.getId());
        return list.stream()
                .map(c -> CourseDto.from(c, grades.findByCourseId(c.getId()).stream().map(GradeDto::from).toList()))
                .toList();
    }
}
