package com.tomato.companion.server.team;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record JoinTeamRequest(@NotBlank @Size(max = 16) String inviteCode) {
}
