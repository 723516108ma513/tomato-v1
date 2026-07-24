export type TeamRole = "OWNER" | "MEMBER";

export interface TeamMember {
  userId: string;
  nickname: string;
  avatarUrl: string | null;
  role: TeamRole;
  joinedAt: string;
}

export interface Team {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  inviteCode: string;
  currentUserRole: TeamRole;
  memberCount: number;
  members: TeamMember[];
  createdAt: string;
  updatedAt: string;
}
