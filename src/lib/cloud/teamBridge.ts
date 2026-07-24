import { invoke } from "@tauri-apps/api/core";
import type { Team } from "./teamTypes";

export function listTeams() {
  return invoke<Team[]>("cloud_list_teams");
}

export function getTeam(teamId: string) {
  return invoke<Team>("cloud_get_team", { teamId });
}

export function createTeam(input: { name: string; description: string }) {
  return invoke<Team>("cloud_create_team", input);
}

export function updateTeam(
  teamId: string,
  input: { name: string; description: string }
) {
  return invoke<Team>("cloud_update_team", { teamId, ...input });
}

export function joinTeam(inviteCode: string) {
  return invoke<Team>("cloud_join_team", { inviteCode });
}

export function rotateTeamInvite(teamId: string) {
  return invoke<Team>("cloud_rotate_team_invite", { teamId });
}

export function leaveTeam(teamId: string) {
  return invoke<void>("cloud_leave_team", { teamId });
}

export function removeTeamMember(teamId: string, userId: string) {
  return invoke<void>("cloud_remove_team_member", { teamId, userId });
}

export function deleteTeam(teamId: string) {
  return invoke<void>("cloud_delete_team", { teamId });
}
