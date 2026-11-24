package kz.narxoz.portal.config;

import kz.narxoz.portal.domain.Course;
import kz.narxoz.portal.domain.Grade;
import kz.narxoz.portal.domain.Role;
import kz.narxoz.portal.domain.User;
import kz.narxoz.portal.repo.CourseRepository;
import kz.narxoz.portal.repo.GradeRepository;
import kz.narxoz.portal.repo.UserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * Creates made-up demo accounts, courses and grades on every start
 * (the H2 database lives in memory). No real people or real data.
 *
 * Demo passwords: Student#2026, Teacher#2026, Admin#2026
 */
@Component
public class DataSeeder implements CommandLineRunner {

    private final UserRepository users;
    private final CourseRepository courses;
    private final GradeRepository grades;
    private final PasswordEncoder encoder;

    public DataSeeder(UserRepository users, CourseRepository courses,
                      GradeRepository grades, PasswordEncoder encoder) {
        this.users = users;
        this.courses = courses;
        this.grades = grades;
        this.encoder = encoder;
    }

    @Override
    public void run(String... args) {
        if (users.count() > 0) {
            return;
        }
        String studentPw = encoder.encode("Student#2026");
        String teacherPw = encoder.encode("Teacher#2026");

        users.save(new User("admin", encoder.encode("Admin#2026"), "Portal Admin",
                "admin@portal.local", "+7 700 000 0000", "DEMO-IIN-0000", null, Role.ADMIN));
        User timur = users.save(new User("teacher_timur", teacherPw, "Timur Teacher",
                "timur@portal.local", "+7 700 000 0101", "DEMO-IIN-0101", null, Role.TEACHER));
        User saule = users.save(new User("teacher_saule", teacherPw, "Saule Teacher",
                "saule@portal.local", "+7 700 000 0102", "DEMO-IIN-0102", null, Role.TEACHER));

        User a = users.save(new User("student_a", studentPw, "Aliya Student",
                "aliya@portal.local", "+7 700 000 0001", "DEMO-IIN-0001", "SEC-23-1", Role.STUDENT));
        User b = users.save(new User("student_b", studentPw, "Bolat Student",
                "bolat@portal.local", "+7 700 000 0002", "DEMO-IIN-0002", "SEC-23-1", Role.STUDENT));
        User c = users.save(new User("student_c", studentPw, "Dana Student",
                "dana@portal.local", "+7 700 000 0003", "DEMO-IIN-0003", "SEC-23-2", Role.STUDENT));

        Course webSec = courses.save(new Course("CS-301", "Web and Mobile Application Security", timur));
        Course secDev = courses.save(new Course("CS-310", "Secure Software Development", timur));
        Course netSec = courses.save(new Course("NET-210", "Network Security", saule));

        grades.save(new Grade(a, webSec, 88, 92, "Strong lab reports"));
        grades.save(new Grade(a, secDev, 75, 81, "Good progress"));
        grades.save(new Grade(a, netSec, 90, 85, null));

        grades.save(new Grade(b, webSec, 61, 55, "Needs to retake Quiz 2"));
        grades.save(new Grade(b, secDev, 70, 64, null));
        grades.save(new Grade(b, netSec, 58, 49, "At risk of failing"));

        grades.save(new Grade(c, webSec, 95, 97, "Excellent"));
        grades.save(new Grade(c, netSec, 80, 78, null));
    }
}
