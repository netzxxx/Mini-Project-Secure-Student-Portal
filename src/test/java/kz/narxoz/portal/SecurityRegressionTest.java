package kz.narxoz.portal;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Security regression tests: the same 6 attacks as security-tests/attack.py,
 * run automatically by "mvn test" and in CI, so a fixed bug cannot come back unnoticed.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class SecurityRegressionTest {

    private static final ObjectMapper JSON = new ObjectMapper();
    private final HttpClient http = HttpClient.newBuilder().proxy(HttpClient.Builder.NO_PROXY).build();

    @LocalServerPort
    int port;

    // ------------------------------------------------------------------ helpers
    record Res(int status, String body, HttpResponse<String> raw) {
        JsonNode json() throws Exception {
            return JSON.readTree(body);
        }
    }

    Res call(String method, String path, String token, Object body) throws Exception {
        HttpRequest.Builder b = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + path))
                .header("Accept", "application/json");
        if (token != null) b.header("Authorization", "Bearer " + token);
        if (body != null) {
            b.header("Content-Type", "application/json");
            b.method(method, HttpRequest.BodyPublishers.ofString(JSON.writeValueAsString(body)));
        } else {
            b.method(method, HttpRequest.BodyPublishers.noBody());
        }
        HttpResponse<String> r = http.send(b.build(), HttpResponse.BodyHandlers.ofString());
        return new Res(r.statusCode(), r.body(), r);
    }

    record Session(String token, long id, Res loginResponse) {
    }

    Session login(String user, String password) throws Exception {
        Res r = call("POST", "/api/auth/login", null, Map.of("username", user, "password", password));
        assertThat(r.status()).as("login " + user).isEqualTo(200);
        return new Session(r.json().get("token").asText(), r.json().get("user").get("id").asLong(), r);
    }

    Session student(String name) throws Exception {
        return login(name, "Student#2026");
    }

    // ------------------------------------------------------------------ T1
    @Test
    @DisplayName("T1 IDOR: a student cannot read another student's grades")
    void t1_idor() throws Exception {
        Session a = student("student_a");
        Session b = student("student_b");
        assertThat(call("GET", "/api/students/" + a.id() + "/grades", a.token(), null).status()).isEqualTo(200);
        assertThat(call("GET", "/api/students/" + b.id() + "/grades", a.token(), null).status()).isEqualTo(403);

        // the denied attempt is visible to the admin in the audit log
        Session admin = login("admin", "Admin#2026");
        assertThat(call("GET", "/api/admin/audit", admin.token(), null).body())
                .contains("READ_GRADES student=" + b.id()).contains("DENIED");
    }

    @Test
    @DisplayName("T1 IDOR: a teacher sees only grades from their own courses")
    void t1_teacherScope() throws Exception {
        Session timur = login("teacher_timur", "Teacher#2026");
        Session a = student("student_a");
        Res r = call("GET", "/api/students/" + a.id() + "/grades", timur.token(), null);
        assertThat(r.status()).isEqualTo(200);
        r.json().forEach(g -> assertThat(g.get("teacherName").asText()).isEqualTo("Timur Teacher"));
    }

    // ------------------------------------------------------------------ T2
    @Test
    @DisplayName("T2 Function-level authorization: student gets 403 on admin API, admin gets 200")
    void t2_adminApi() throws Exception {
        Session a = student("student_a");
        Session admin = login("admin", "Admin#2026");
        assertThat(call("GET", "/api/admin/users", a.token(), null).status()).isEqualTo(403);
        assertThat(call("GET", "/api/admin/audit", a.token(), null).status()).isEqualTo(403);
        assertThat(call("PUT", "/api/admin/users/" + a.id() + "/role", a.token(), Map.of("role", "ADMIN")).status())
                .isEqualTo(403);
        assertThat(call("GET", "/api/teacher/courses", a.token(), null).status()).isEqualTo(403);
        assertThat(call("GET", "/api/admin/users", admin.token(), null).status()).isEqualTo(200);
    }

    // ------------------------------------------------------------------ T3
    @Test
    @DisplayName("T3 Data exposure: no passwordHash or IIN in any response")
    void t3_dataExposure() throws Exception {
        Session a = student("student_a");
        Session b = student("student_b");
        Session admin = login("admin", "Admin#2026");
        for (String body : new String[]{
                a.loginResponse().body(),
                call("GET", "/api/me", a.token(), null).body(),
                call("GET", "/api/admin/users", admin.token(), null).body()}) {
            assertThat(body).doesNotContain("passwordHash").doesNotContain("\"iin\"");
        }
        assertThat(call("GET", "/api/users/" + b.id(), a.token(), null).status()).isEqualTo(403);
    }

    // ------------------------------------------------------------------ T4
    @Test
    @DisplayName("T4 Mass assignment: role cannot be changed through PATCH /api/me")
    void t4_massAssignment() throws Exception {
        Session c = student("student_c");
        Res attack = call("PATCH", "/api/me", c.token(), Map.of("fullName", "Dana Student", "role", "ADMIN"));
        assertThat(attack.status()).isEqualTo(400);
        Session again = student("student_c");
        assertThat(call("GET", "/api/me", again.token(), null).json().get("role").asText()).isEqualTo("STUDENT");
        assertThat(call("PATCH", "/api/me", again.token(), Map.of("fullName", "Dana Student")).status()).isEqualTo(200);
    }

    // ------------------------------------------------------------------ T5
    @Test
    @DisplayName("T5 Brute force: 6th wrong password is answered with 429")
    void t5_bruteForce() throws Exception {
        for (int i = 0; i < 5; i++) {
            Res r = call("POST", "/api/auth/login", null, Map.of("username", "teacher_saule", "password", "guess" + i));
            assertThat(r.status()).isEqualTo(401);
        }
        Res locked = call("POST", "/api/auth/login", null, Map.of("username", "teacher_saule", "password", "guess5"));
        assertThat(locked.status()).isEqualTo(429);
        assertThat(locked.raw().headers().firstValue("Retry-After")).isPresent();
    }

    // ------------------------------------------------------------------ T6
    @Test
    @DisplayName("T6 Misconfiguration: console closed, no stack traces, security headers present")
    void t6_misconfiguration() throws Exception {
        Session a = student("student_a");
        assertThat(call("GET", "/h2-console/", null, null).status()).isNotEqualTo(200);

        Res bad = call("GET", "/api/students/abc/grades", a.token(), null);
        assertThat(bad.status()).isEqualTo(400);
        assertThat(bad.body()).doesNotContain("trace").doesNotContain("at org.springframework");

        HttpResponse<String> home = call("GET", "/api/info", null, null).raw();
        assertThat(home.headers().firstValue("X-Content-Type-Options")).hasValue("nosniff");
        assertThat(home.headers().firstValue("X-Frame-Options")).hasValue("DENY");
        assertThat(home.headers().firstValue("Content-Security-Policy")).isPresent();
    }
}
