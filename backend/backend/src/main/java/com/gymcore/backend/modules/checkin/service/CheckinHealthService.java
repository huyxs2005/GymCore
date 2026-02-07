package com.gymcore.backend.modules.checkin.service;

import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.stereotype.Service;

@Service
public class CheckinHealthService {

    public Map<String, Object> execute(String action, Object payload) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("module", "checkin-health");
        response.put("action", action);
        response.put("status", "TODO");
        response.put("payload", payload == null ? Map.of() : payload);
        return response;
    }
}
