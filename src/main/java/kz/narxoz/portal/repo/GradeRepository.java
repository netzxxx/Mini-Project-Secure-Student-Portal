package kz.narxoz.portal.repo;

import kz.narxoz.portal.domain.Grade;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface GradeRepository extends JpaRepository<Grade, Long> {
    List<Grade> findByStudentId(Long studentId);

    List<Grade> findByCourseId(Long courseId);

    boolean existsByStudentIdAndCourseTeacherId(Long studentId, Long teacherId);
}
