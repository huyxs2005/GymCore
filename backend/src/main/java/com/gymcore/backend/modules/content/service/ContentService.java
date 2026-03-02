package com.gymcore.backend.modules.content.service;

import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ContentService {

    public Map<String, Object> execute(String action, Object payload) {
        throw new ResponseStatusException(HttpStatus.NOT_IMPLEMENTED, "Unsupported content action: " + action);
    }
}
