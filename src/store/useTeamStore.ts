import { create } from "zustand";
import {
  createTeam,
  deleteTeam,
  getTeam,
  joinTeam,
  leaveTeam,
  listTeams,
  removeTeamMember,
  rotateTeamInvite,
  updateTeam
} from "../lib/cloud/teamBridge";
import type { Team } from "../lib/cloud/teamTypes";

interface TeamStore {
  teams: Team[];
  selectedTeam: Team | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  reset: () => void;
  clearError: () => void;
  loadTeams: () => Promise<void>;
  selectTeam: (teamId: string) => Promise<void>;
  create: (name: string, description: string) => Promise<boolean>;
  join: (inviteCode: string) => Promise<boolean>;
  update: (name: string, description: string) => Promise<boolean>;
  rotateInvite: () => Promise<void>;
  removeMember: (userId: string) => Promise<void>;
  leave: () => Promise<void>;
  deleteCurrent: () => Promise<void>;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function upsert(teams: Team[], updated: Team) {
  const exists = teams.some((team) => team.id === updated.id);
  return exists
    ? teams.map((team) => (team.id === updated.id ? updated : team))
    : [updated, ...teams];
}

export const useTeamStore = create<TeamStore>((set, get) => ({
  teams: [],
  selectedTeam: null,
  loading: false,
  saving: false,
  error: null,

  reset: () => set({ teams: [], selectedTeam: null, error: null }),
  clearError: () => set({ error: null }),

  loadTeams: async () => {
    set({ loading: true, error: null });
    try {
      const teams = await listTeams();
      set({ teams, loading: false });
      if (teams.length && !get().selectedTeam) {
        await get().selectTeam(teams[0].id);
      }
    } catch (error) {
      set({ loading: false, error: errorMessage(error) });
    }
  },

  selectTeam: async (teamId) => {
    set({ loading: true, error: null });
    try {
      const selectedTeam = await getTeam(teamId);
      set((state) => ({
        selectedTeam,
        teams: upsert(state.teams, selectedTeam),
        loading: false
      }));
    } catch (error) {
      set({ loading: false, error: errorMessage(error) });
    }
  },

  create: async (name, description) => {
    set({ saving: true, error: null });
    try {
      const team = await createTeam({ name, description });
      set((state) => ({
        teams: upsert(state.teams, team),
        selectedTeam: team,
        saving: false
      }));
      return true;
    } catch (error) {
      set({ saving: false, error: errorMessage(error) });
      return false;
    }
  },

  join: async (inviteCode) => {
    set({ saving: true, error: null });
    try {
      const team = await joinTeam(inviteCode.trim().toUpperCase());
      set((state) => ({
        teams: upsert(state.teams, team),
        selectedTeam: team,
        saving: false
      }));
      return true;
    } catch (error) {
      set({ saving: false, error: errorMessage(error) });
      return false;
    }
  },

  update: async (name, description) => {
    const current = get().selectedTeam;
    if (!current) return false;
    set({ saving: true, error: null });
    try {
      const team = await updateTeam(current.id, { name, description });
      set((state) => ({
        teams: upsert(state.teams, team),
        selectedTeam: team,
        saving: false
      }));
      return true;
    } catch (error) {
      set({ saving: false, error: errorMessage(error) });
      return false;
    }
  },

  rotateInvite: async () => {
    const current = get().selectedTeam;
    if (!current) return;
    set({ saving: true, error: null });
    try {
      const team = await rotateTeamInvite(current.id);
      set((state) => ({
        teams: upsert(state.teams, team),
        selectedTeam: team,
        saving: false
      }));
    } catch (error) {
      set({ saving: false, error: errorMessage(error) });
    }
  },

  removeMember: async (userId) => {
    const current = get().selectedTeam;
    if (!current) return;
    set({ saving: true, error: null });
    try {
      await removeTeamMember(current.id, userId);
      await get().selectTeam(current.id);
      set({ saving: false });
    } catch (error) {
      set({ saving: false, error: errorMessage(error) });
    }
  },

  leave: async () => {
    const current = get().selectedTeam;
    if (!current) return;
    set({ saving: true, error: null });
    try {
      await leaveTeam(current.id);
      const teams = get().teams.filter((team) => team.id !== current.id);
      set({ teams, selectedTeam: null, saving: false });
      if (teams.length) await get().selectTeam(teams[0].id);
    } catch (error) {
      set({ saving: false, error: errorMessage(error) });
    }
  },

  deleteCurrent: async () => {
    const current = get().selectedTeam;
    if (!current) return;
    set({ saving: true, error: null });
    try {
      await deleteTeam(current.id);
      const teams = get().teams.filter((team) => team.id !== current.id);
      set({ teams, selectedTeam: null, saving: false });
      if (teams.length) await get().selectTeam(teams[0].id);
    } catch (error) {
      set({ saving: false, error: errorMessage(error) });
    }
  }
}));
