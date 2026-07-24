package com.tomato.companion.server;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
class TeamIntegrationTest {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private StringRedisTemplate redisTemplate;

    @Test
    void ownerCreatesTeamAndMemberJoinsWithInviteCode() throws Exception {
        String ownerToken = register("Owner");
        String memberToken = register("Member");
        JsonNode team = createTeam(ownerToken, "Exam Team");
        String teamId = team.at("/data/id").asText();
        String inviteCode = team.at("/data/inviteCode").asText();

        mockMvc.perform(post("/api/v1/teams/join")
                        .header("Authorization", bearer(memberToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("inviteCode", inviteCode.toLowerCase()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.currentUserRole").value("MEMBER"))
                .andExpect(jsonPath("$.data.memberCount").value(2));

        mockMvc.perform(get("/api/v1/teams/{teamId}", teamId)
                        .header("Authorization", bearer(ownerToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.currentUserRole").value("OWNER"))
                .andExpect(jsonPath("$.data.members.length()").value(2));
    }

    @Test
    void permissionsAndInviteErrorsUseStableCodes() throws Exception {
        String ownerToken = register("Owner");
        String outsiderToken = register("Outsider");
        JsonNode team = createTeam(ownerToken, "Focus Team");
        String teamId = team.at("/data/id").asText();

        mockMvc.perform(get("/api/v1/teams/{teamId}", teamId)
                        .header("Authorization", bearer(outsiderToken)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("TEAM_ACCESS_DENIED"));

        mockMvc.perform(post("/api/v1/teams/join")
                        .header("Authorization", bearer(outsiderToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("inviteCode", "INVALID8"))))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("INVALID_INVITE_CODE"));

        mockMvc.perform(delete("/api/v1/teams/{teamId}", teamId)
                        .header("Authorization", bearer(outsiderToken)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("TEAM_OWNER_REQUIRED"));
    }

    private JsonNode createTeam(String token, String name) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/teams")
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("name", name, "description", "Study together"))))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    private String register(String nickname) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of(
                                "email", "team-" + UUID.randomUUID() + "@example.com",
                                "password", "password-123",
                                "nickname", nickname))))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper
                .readTree(result.getResponse().getContentAsString())
                .at("/data/accessToken")
                .asText();
    }

    private String json(Object value) throws Exception {
        return objectMapper.writeValueAsString(value);
    }

    private String bearer(String token) {
        return "Bearer " + token;
    }
}
