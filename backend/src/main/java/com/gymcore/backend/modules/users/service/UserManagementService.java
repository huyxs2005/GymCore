package com.gymcore.backend.modules.users.service;

import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.stereotype.Service;

@Service
public class UserManagementService {

    public Map<String, Object> execute(String action, Object payload) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("module", "users");
        response.put("action", action);
        response.put("status", "TODO");
        response.put("payload", payload == null ? Map.of() : payload);
        return response;
    }
}
