package kz.narxoz.portal.domain;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;

import java.time.Instant;

/**
 * Simple security event log (logins, denied requests, admin actions).
 */
@Entity
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Instant timestamp;
    private String username;
    private String action;
    private String outcome;
    private String ip;

    protected AuditLog() {
    }

    public AuditLog(String username, String action, String outcome, String ip) {
        this.timestamp = Instant.now();
        this.username = username;
        this.action = action;
        this.outcome = outcome;
        this.ip = ip;
    }

    public Long getId() { return id; }
    public Instant getTimestamp() { return timestamp; }
    public String getUsername() { return username; }
    public String getAction() { return action; }
    public String getOutcome() { return outcome; }
    public String getIp() { return ip; }
}
