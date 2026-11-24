package kz.narxoz.portal.web.dto;

import kz.narxoz.portal.domain.Course;

import java.util.List;

/** A course taught by the current teacher, with the grades of its students. */
public record CourseDto(Long id, String code, String title, String teacherName, List<GradeDto> grades) {

    public static CourseDto from(Course c, List<GradeDto> grades) {
        return new CourseDto(c.getId(), c.getCode(), c.getTitle(), c.getTeacher().getFullName(), grades);
    }
}
