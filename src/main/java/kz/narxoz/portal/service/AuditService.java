package kz.narxoz.portal.service;

import jakarta.servlet.http.HttpServletRequest;
import kz.narxoz.portal.domain.AuditLog;
import kz.narxoz.portal.repo.AuditLogRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class AuditService {

    private final AuditLogRepository repo;

    public AuditService(AuditLogRepository repo) {
        this.repo = repo;
    }

    /**
     * Runs in its own transaction, so a DENIED entry is saved even when the
     * caller's transaction is rolled back by the 403 exception.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void log(String username, String action, String outcome, HttpServletRequest request) {
        String ip = request != null ? request.getRemoteAddr() : "-";
        repo.save(new AuditLog(username, action, outcome, ip));
    }

    public List<AuditLog> latest() {
        return repo.findTop100ByOrderByIdDesc();
    }
}
