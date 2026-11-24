package kz.narxoz.portal.web.dto;

import kz.narxoz.portal.domain.Grade;

import java.time.Instant;

public record GradeDto(
        Long id,
        String courseCode,
        String courseTitle,
        String teacherName,
        Long studentId,
        String studentName,
        int midterm,
        int finalExam,
        int total,
        String letter,
        String teacherComment,
        Instant updatedAt) {

    public static GradeDto from(Grade g) {
        return new GradeDto(
                g.getId(),
                g.getCourse().getCode(),
                g.getCourse().getTitle(),
                g.getCourse().getTeacher().getFullName(),
                g.getStudent().getId(),
                g.getStudent().getFullName(),
                g.getMidterm(),
                g.getFinalExam(),
                g.getTotal(),
                letter(g.getTotal()),
                g.getTeacherComment(),
                g.getUpdatedAt());
    }

    static String letter(int total) {
        if (total >= 95) return "A";
        if (total >= 90) return "A-";
        if (total >= 85) return "B+";
        if (total >= 80) return "B";
        if (total >= 75) return "B-";
        if (total >= 70) return "C+";
        if (total >= 65) return "C";
        if (total >= 60) return "C-";
        if (total >= 55) return "D+";
        if (total >= 50) return "D";
        return "F";
    }
}
