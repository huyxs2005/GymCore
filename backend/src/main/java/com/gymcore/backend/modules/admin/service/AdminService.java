package com.gymcore.backend.modules.admin.service;

import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.stereotype.Service;

@Service
public class AdminService {

    public Map<String, Object> execute(String action, Object payload) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("module", "admin");
        response.put("action", action);
        response.put("status", "TODO");
        response.put("payload", payload == null ? Map.of() : payload);
        return response;
    }
}
