package kz.narxoz.portal.web;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/** Tells the UI which build is running, so screenshots clearly show BEFORE or AFTER. */
@RestController
public class InfoController {

    private final String build;

    public InfoController(@Value("${app.build-label}") String build) {
        this.build = build;
    }

    @GetMapping("/api/info")
    public Map<String, String> info() {
        return Map.of("app", "Secure Student Portal", "build", build);
    }
}
