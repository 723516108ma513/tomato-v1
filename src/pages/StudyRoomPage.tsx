import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Crown,
  DoorOpen,
  LoaderCircle,
  Play,
  Radio,
  UsersRound,
  XCircle
} from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { useStudyRoomStore } from "../store/useStudyRoomStore";
import { useTeamStore } from "../store/useTeamStore";

function formatSeconds(total: number) {
  const safe = Math.max(0, total);
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

export function StudyRoomPage() {
  const currentUser = useAuthStore((state) => state.currentUser);
  const authStatus = useAuthStore((state) => state.status);
  const openDialog = useAuthStore((state) => state.openDialog);
  const teams = useTeamStore((state) => state.teams);
  const selectedTeam = useTeamStore((state) => state.selectedTeam);
  const loadTeams = useTeamStore((state) => state.loadTeams);
  const {
    room,
    teamId,
    connection,
    loading,
    saving,
    error,
    initialize,
    loadActive,
    create,
    join,
    setReady,
    start,
    leave,
    cancel,
    reset
  } = useStudyRoomStore();
  const [name, setName] = useState("一起专注");
  const [minutes, setMinutes] = useState(25);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    void initialize();
    if (!teams.length) void loadTeams();
  }, [authStatus, initialize, loadTeams, teams.length]);

  useEffect(() => {
    const preferredTeamId = teamId ?? selectedTeam?.id ?? teams[0]?.id;
    if (authStatus === "authenticated" && preferredTeamId && !room) {
      void loadActive(preferredTeamId);
    }
  }, [authStatus, loadActive, room, selectedTeam?.id, teamId, teams]);

  useEffect(() => {
    if (!room?.currentSession) {
      setRemaining(0);
      return;
    }
    const offset = new Date(room.serverTime).getTime() - Date.now();
    const update = () => {
      const serverNow = Date.now() + offset;
      setRemaining(Math.max(0, Math.ceil((new Date(room.currentSession!.endTime).getTime() - serverNow) / 1000)));
    };
    update();
    const timer = window.setInterval(update, 500);
    return () => window.clearInterval(timer);
  }, [room?.currentSession, room?.serverTime]);

  const ownMember = room?.members.find((member) => member.userId === currentUser?.id);
  const allReady = Boolean(room?.members.length) && room!.members.every((member) => member.ready);
  const progress = room?.currentSession
    ? Math.max(0, Math.min(1, 1 - remaining / room.currentSession.durationSeconds))
    : 0;
  const selectedTeamId = teamId ?? selectedTeam?.id ?? teams[0]?.id ?? "";
  const selectedTeamName = useMemo(
    () => teams.find((team) => team.id === selectedTeamId)?.name ?? "当前团队",
    [selectedTeamId, teams]
  );

  if (authStatus !== "authenticated") {
    return (
      <section className="team-login-gate panel">
        <span><Radio size={27} /></span>
        <p className="eyebrow">LIVE FOCUS ROOM</p>
        <h2>登录后进入同步学习房间</h2>
        <p>房间计时独立于个人番茄钟，由服务端统一开始和结束。</p>
        <button className="button button-primary" type="button" onClick={() => openDialog("login")}>登录或注册</button>
      </section>
    );
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!selectedTeamId || !name.trim()) return;
    await create(selectedTeamId, name.trim(), minutes * 60);
  }

  if (!teams.length && !loading) {
    return (
      <section className="room-empty panel">
        <UsersRound size={28} />
        <h2>先创建或加入一个团队</h2>
        <p>学习房间属于团队，请先到“组队”页面准备好你的学习小队。</p>
      </section>
    );
  }

  return (
    <div className="room-page">
      <div className="room-toolbar panel">
        <label>
          <span>当前团队</span>
          <select
            value={selectedTeamId}
            onChange={(event) => {
              void reset().then(() => loadActive(event.target.value));
            }}
          >
            {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
          </select>
        </label>
        <div className={`connection-badge ${connection}`}>
          <span />
          {connection === "connected" ? "实时连接" : connection === "reconnecting" ? "正在重连" : "未连接"}
        </div>
      </div>

      {error && (
        <div className="team-error" role="alert"><AlertCircle size={16} /><span>{error}</span></div>
      )}

      {loading ? (
        <div className="room-empty panel"><LoaderCircle className="spin-icon" size={26} /><p>正在读取房间状态…</p></div>
      ) : !room ? (
        <section className="room-create panel">
          <div>
            <p className="eyebrow">NEW FOCUS ROOM</p>
            <h2>为“{selectedTeamName}”创建学习房间</h2>
            <p>每个团队同时只能有一个活动房间。开始后，所有成员看到相同的结束时间。</p>
          </div>
          <form onSubmit={handleCreate}>
            <label className="field">
              <span>房间名称</span>
              <input value={name} onChange={(event) => setName(event.target.value)} maxLength={100} />
            </label>
            <label className="field">
              <span>专注时长</span>
              <select value={minutes} onChange={(event) => setMinutes(Number(event.target.value))}>
                {[15, 20, 25, 30, 45, 50, 60, 90].map((value) => <option key={value} value={value}>{value} 分钟</option>)}
              </select>
            </label>
            <button className="button button-primary" type="submit" disabled={saving || !name.trim()}>
              <DoorOpen size={16} /> 创建并进入
            </button>
          </form>
        </section>
      ) : (
        <div className="room-layout">
          <section className="room-stage panel">
            <div className="room-title">
              <div>
                <p className="eyebrow">{selectedTeamName}</p>
                <h2>{room.name}</h2>
              </div>
              <span>{room.status === "FOCUS" ? "专注中" : "等待准备"}</span>
            </div>

            {room.status === "FOCUS" && room.currentSession ? (
              <div className="remote-timer">
                <div className="remote-timer-ring" style={{ "--room-progress": `${progress * 360}deg` } as CSSProperties}>
                  <div>
                    <span>团队专注</span>
                    <strong>{formatSeconds(remaining)}</strong>
                    <small>结束时间由服务器同步</small>
                  </div>
                </div>
                <p><Clock3 size={15} /> 本轮 {Math.round(room.currentSession.durationSeconds / 60)} 分钟</p>
              </div>
            ) : (
              <div className="room-waiting">
                <UsersRound size={34} />
                <h3>{ownMember ? "等待所有人准备" : "团队正在等你加入"}</h3>
                <p>{ownMember ? "准备后仍可取消；只有房主能统一开始。" : "加入后你会出现在成员列表，并建立实时连接。"}</p>
                {!ownMember ? (
                  <button className="button button-primary" type="button" onClick={() => void join()} disabled={saving}>
                    <DoorOpen size={16} /> 加入房间
                  </button>
                ) : (
                  <button
                    className={`button ${ownMember.ready ? "button-secondary" : "button-primary"}`}
                    type="button"
                    onClick={() => void setReady(!ownMember.ready)}
                    disabled={saving}
                  >
                    {ownMember.ready ? <XCircle size={16} /> : <CheckCircle2 size={16} />}
                    {ownMember.ready ? "取消准备" : "我准备好了"}
                  </button>
                )}
                {room.currentUserIsHost && ownMember && (
                  <button className="button button-secondary" type="button" onClick={() => void start()} disabled={saving || !allReady}>
                    <Play size={16} /> 开始同步番茄钟
                  </button>
                )}
              </div>
            )}
          </section>

          <aside className="room-members panel">
            <div className="panel-heading simple">
              <div><h2>房间成员</h2><p>{room.members.length} 人 · {room.members.filter((member) => member.ready).length} 人已准备</p></div>
            </div>
            <div className="room-member-list">
              {room.members.map((member) => (
                <div key={member.userId}>
                  <span className="member-avatar">{member.nickname.slice(0, 1)}</span>
                  <span>
                    <strong>{member.nickname}{member.userId === currentUser?.id ? "（你）" : ""}</strong>
                    <small className={member.online ? "is-online" : ""}>{member.online ? "在线" : "暂时离线"}</small>
                  </span>
                  {member.host ? <Crown size={14} /> : member.ready ? <CheckCircle2 size={15} /> : <Clock3 size={15} />}
                </div>
              ))}
            </div>
            <button
              className="room-exit"
              type="button"
              onClick={() => {
                if (room.currentUserIsHost) {
                  if (window.confirm("关闭房间会结束所有人的本轮学习，确定继续吗？")) void cancel();
                } else if (window.confirm("确定离开学习房间吗？")) {
                  void leave();
                }
              }}
            >
              {room.currentUserIsHost ? "关闭房间" : "离开房间"}
            </button>
          </aside>
        </div>
      )}
    </div>
  );
}
