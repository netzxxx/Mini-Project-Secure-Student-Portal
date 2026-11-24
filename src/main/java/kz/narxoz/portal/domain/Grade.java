package kz.narxoz.portal.domain;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.ManyToOne;

import java.time.Instant;

@Entity
public class Grade {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    private User student;

    @ManyToOne(optional = false)
    private Course course;

    private int midterm;
    private int finalExam;
    private String teacherComment;
    private Instant updatedAt;

    protected Grade() {
    }

    public Grade(User student, Course course, int midterm, int finalExam, String teacherComment) {
        this.student = student;
        this.course = course;
        this.midterm = midterm;
        this.finalExam = finalExam;
        this.teacherComment = teacherComment;
        this.updatedAt = Instant.now();
    }

    /** Total score out of 100 (40% midterm + 60% final). */
    public int getTotal() {
        return Math.round(midterm * 0.4f + finalExam * 0.6f);
    }

    public Long getId() { return id; }
    public User getStudent() { return student; }
    public Course getCourse() { return course; }

    public int getMidterm() { return midterm; }
    public void setMidterm(int midterm) { this.midterm = midterm; }

    public int getFinalExam() { return finalExam; }
    public void setFinalExam(int finalExam) { this.finalExam = finalExam; }

    public String getTeacherComment() { return teacherComment; }
    public void setTeacherComment(String teacherComment) { this.teacherComment = teacherComment; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
