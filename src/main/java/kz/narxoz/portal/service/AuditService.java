package kz.narxoz.portal.service;

import jakarta.servlet.http.HttpServletRequest;
import kz.narxoz.portal.domain.AuditLog;
import kz.narxoz.portal.repo.AuditLogRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class AuditService {

    private final AuditLogRepository repo;

    public AuditService(AuditLogRepository repo) {
        this.repo = repo;
    }

    public void log(String username, String action, String outcome, HttpServletRequest request) {
        String ip = request != null ? request.getRemoteAddr() : "-";
        repo.save(new AuditLog(username, action, outcome, ip));
    }

    public List<AuditLog> latest() {
        return repo.findTop100ByOrderByIdDesc();
    }
}
