import { useEffect, useState, type FormEvent } from "react";
import {
  AlertCircle,
  Check,
  Clipboard,
  Crown,
  DoorOpen,
  LoaderCircle,
  Plus,
  RefreshCw,
  Shield,
  Trash2,
  UserMinus,
  UsersRound
} from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { useTeamStore } from "../store/useTeamStore";

export function TeamPage() {
  const authStatus = useAuthStore((state) => state.status);
  const currentUser = useAuthStore((state) => state.currentUser);
  const openDialog = useAuthStore((state) => state.openDialog);
  const {
    teams,
    selectedTeam,
    loading,
    saving,
    error,
    reset,
    loadTeams,
    selectTeam,
    create,
    join,
    update,
    rotateInvite,
    removeMember,
    leave,
    deleteCurrent
  } = useTeamStore();
  const [mode, setMode] = useState<"create" | "join">("create");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (authStatus === "authenticated") {
      void loadTeams();
    } else {
      reset();
    }
  }, [authStatus, loadTeams, reset]);

  if (authStatus !== "authenticated") {
    return (
      <section className="team-login-gate panel">
        <span><UsersRound size={27} /></span>
        <p className="eyebrow">STUDY TOGETHER</p>
        <h2>登录后创建你的学习小队</h2>
        <p>组队功能使用云端账号；你的本地任务、番茄记录、AI 对话与密钥不会上传。</p>
        <button className="button button-primary" type="button" onClick={() => openDialog("login")}>
          登录或注册
        </button>
      </section>
    );
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    if (await create(name.trim(), description.trim())) {
      setName("");
      setDescription("");
    }
  }

  async function handleJoin(event: FormEvent) {
    event.preventDefault();
    if (!inviteCode.trim()) return;
    if (await join(inviteCode)) setInviteCode("");
  }

  async function handleEdit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    if (await update(name.trim(), description.trim())) setEditing(false);
  }

  async function copyInvite() {
    if (!selectedTeam) return;
    await navigator.clipboard.writeText(selectedTeam.inviteCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="team-page">
      <aside className="team-sidebar panel">
        <div className="team-sidebar-heading">
          <div>
            <p className="eyebrow">YOUR TEAMS</p>
            <h2>我的团队</h2>
          </div>
          {loading && <LoaderCircle className="spin-icon" size={16} />}
        </div>

        <div className="team-list">
          {teams.map((team) => (
            <button
              type="button"
              key={team.id}
              className={selectedTeam?.id === team.id ? "is-active" : ""}
              onClick={() => void selectTeam(team.id)}
            >
              <span className="team-list-icon"><UsersRound size={16} /></span>
              <span>
                <strong>{team.name}</strong>
                <small>{team.memberCount} 位成员</small>
              </span>
              {team.currentUserRole === "OWNER" && <Crown size={13} />}
            </button>
          ))}
          {!teams.length && !loading && (
            <p className="team-empty-copy">还没有团队，可以创建一个或使用邀请码加入。</p>
          )}
        </div>

        <div className="team-entry">
          <div className="team-entry-tabs">
            <button type="button" className={mode === "create" ? "is-active" : ""} onClick={() => setMode("create")}>
              创建
            </button>
            <button type="button" className={mode === "join" ? "is-active" : ""} onClick={() => setMode("join")}>
              加入
            </button>
          </div>
          {mode === "create" ? (
            <form onSubmit={handleCreate}>
              <label>
                <span>团队名称</span>
                <input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} placeholder="例如：期末冲刺小队" />
              </label>
              <label>
                <span>简介（可选）</span>
                <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} placeholder="我们一起完成什么？" />
              </label>
              <button className="button button-primary full-width" type="submit" disabled={saving || !name.trim()}>
                <Plus size={15} /> 创建团队
              </button>
            </form>
          ) : (
            <form onSubmit={handleJoin}>
              <label>
                <span>邀请码</span>
                <input className="invite-input" value={inviteCode} onChange={(event) => setInviteCode(event.target.value.toUpperCase())} maxLength={16} placeholder="输入 8 位邀请码" />
              </label>
              <button className="button button-primary full-width" type="submit" disabled={saving || !inviteCode.trim()}>
                <DoorOpen size={15} /> 加入团队
              </button>
            </form>
          )}
        </div>
      </aside>

      <section className="team-content">
        {error && (
          <div className="team-error" role="alert">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}
        {selectedTeam ? (
          <>
            <article className="team-hero panel">
              <div className="team-hero-heading">
                <div>
                  <span className="team-role-badge">
                    {selectedTeam.currentUserRole === "OWNER" ? <Crown size={13} /> : <Shield size={13} />}
                    {selectedTeam.currentUserRole === "OWNER" ? "创建者" : "成员"}
                  </span>
                  <h2>{selectedTeam.name}</h2>
                  <p>{selectedTeam.description || "这个团队还没有填写简介。"}</p>
                </div>
                {selectedTeam.currentUserRole === "OWNER" && (
                  <button
                    className="button button-secondary"
                    type="button"
                    onClick={() => {
                      setName(selectedTeam.name);
                      setDescription(selectedTeam.description);
                      setEditing(true);
                    }}
                  >
                    编辑团队
                  </button>
                )}
              </div>
              <div className="invite-card">
                <div>
                  <span>团队邀请码</span>
                  <strong>{selectedTeam.inviteCode}</strong>
                  <small>把它发给想一起学习的人</small>
                </div>
                <button type="button" onClick={() => void copyInvite()}>
                  {copied ? <Check size={16} /> : <Clipboard size={16} />}
                  {copied ? "已复制" : "复制"}
                </button>
                {selectedTeam.currentUserRole === "OWNER" && (
                  <button type="button" onClick={() => void rotateInvite()} disabled={saving} title="旧邀请码会立即失效">
                    <RefreshCw size={16} />
                    换一个
                  </button>
                )}
              </div>
            </article>

            {editing && (
              <form className="team-edit-card panel" onSubmit={handleEdit}>
                <label>
                  <span>团队名称</span>
                  <input autoFocus value={name} onChange={(event) => setName(event.target.value)} maxLength={80} />
                </label>
                <label>
                  <span>团队简介</span>
                  <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} />
                </label>
                <div>
                  <button className="button button-secondary" type="button" onClick={() => setEditing(false)}>取消</button>
                  <button className="button button-primary" type="submit" disabled={saving}>保存</button>
                </div>
              </form>
            )}

            <article className="team-members panel">
              <div className="panel-heading simple">
                <div>
                  <h2>团队成员</h2>
                  <p>{selectedTeam.memberCount} 人正在这个团队里互相陪伴</p>
                </div>
              </div>
              <div className="team-member-list">
                {selectedTeam.members.map((member) => (
                  <div key={member.userId}>
                    <span className="member-avatar">{member.nickname.slice(0, 1).toUpperCase()}</span>
                    <span>
                      <strong>{member.nickname}{member.userId === currentUser?.id ? "（你）" : ""}</strong>
                      <small>{new Date(member.joinedAt).toLocaleDateString("zh-CN")} 加入</small>
                    </span>
                    <span className={`member-role ${member.role.toLowerCase()}`}>
                      {member.role === "OWNER" ? <Crown size={12} /> : <Shield size={12} />}
                      {member.role === "OWNER" ? "创建者" : "成员"}
                    </span>
                    {selectedTeam.currentUserRole === "OWNER" && member.role !== "OWNER" && (
                      <button
                        className="member-remove"
                        type="button"
                        title="移出团队"
                        aria-label={`将 ${member.nickname} 移出团队`}
                        onClick={() => {
                          if (window.confirm(`确定将 ${member.nickname} 移出团队吗？`)) {
                            void removeMember(member.userId);
                          }
                        }}
                      >
                        <UserMinus size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </article>

            <div className="team-danger-zone">
              {selectedTeam.currentUserRole === "OWNER" ? (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm("确定删除这个团队吗？该操作无法撤销。")) void deleteCurrent();
                  }}
                >
                  <Trash2 size={15} /> 删除团队
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm("确定退出这个团队吗？")) void leave();
                  }}
                >
                  <DoorOpen size={15} /> 退出团队
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="team-content-empty panel">
            <UsersRound size={30} />
            <h2>从左侧开始</h2>
            <p>创建一个学习团队，或者输入朋友分享的邀请码。</p>
          </div>
        )}
      </section>
    </div>
  );
}
