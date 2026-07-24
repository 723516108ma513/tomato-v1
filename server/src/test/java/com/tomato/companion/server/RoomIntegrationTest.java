package com.tomato.companion.server;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class RoomIntegrationTest {
    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @MockBean StringRedisTemplate redisTemplate;

    @Test
    void teamMembersReadyAndHostStartsSynchronizedSession() throws Exception {
        String owner = register("Host");
        String member = register("Learner");
        JsonNode team = requestJson(post("/api/v1/teams")
                .header("Authorization", bearer(owner))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("name", "Study Team", "description", ""))));
        String teamId = team.at("/data/id").asText();
        String invite = team.at("/data/inviteCode").asText();
        mockMvc.perform(post("/api/v1/teams/join")
                        .header("Authorization", bearer(member))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("inviteCode", invite))))
                .andExpect(status().isOk());

        JsonNode room = requestJson(post("/api/v1/teams/{teamId}/rooms", teamId)
                .header("Authorization", bearer(owner))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("name", "Focus now", "focusSeconds", 60))));
        String roomId = room.at("/data/id").asText();

        mockMvc.perform(post("/api/v1/rooms/{roomId}/join", roomId)
                        .header("Authorization", bearer(member)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.members.length()").value(2));
        setReady(roomId, owner);
        setReady(roomId, member);

        mockMvc.perform(post("/api/v1/rooms/{roomId}/start", roomId)
                        .header("Authorization", bearer(member)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ROOM_HOST_REQUIRED"));

        mockMvc.perform(post("/api/v1/rooms/{roomId}/start", roomId)
                        .header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("FOCUS"))
                .andExpect(jsonPath("$.data.currentSession.status").value("RUNNING"))
                .andExpect(jsonPath("$.data.currentSession.durationSeconds").value(60));

        mockMvc.perform(get("/api/v1/rooms/{roomId}/sessions", roomId)
                        .header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1));
    }

    private void setReady(String roomId, String token) throws Exception {
        mockMvc.perform(put("/api/v1/rooms/{roomId}/ready", roomId)
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("ready", true))))
                .andExpect(status().isOk());
    }

    private String register(String nickname) throws Exception {
        JsonNode response = requestJson(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of(
                        "email", "room-" + UUID.randomUUID() + "@example.com",
                        "password", "password-123",
                        "nickname", nickname))));
        return response.at("/data/accessToken").asText();
    }

    private JsonNode requestJson(
            org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder request)
            throws Exception {
        MvcResult result = mockMvc.perform(request)
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    private String json(Object value) throws Exception {
        return objectMapper.writeValueAsString(value);
    }

    private String bearer(String token) {
        return "Bearer " + token;
    }
}
