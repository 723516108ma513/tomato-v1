import { FormEvent, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Bot,
  Brain,
  Loader2,
  Send,
  Sparkles,
  Trash2
} from "lucide-react";
import { PlanImportDialog } from "../components/PlanImportDialog";
import { generateLearningPlan } from "../lib/bridge";
import { useAppStore } from "../store/useAppStore";
import type { LearningPlanDraft } from "../types";

export function CompanionPage() {
  const snapshot = useAppStore((state) => state.snapshot);
  const setPage = useAppStore((state) => state.setPage);
  const sendChat = useAppStore((state) => state.sendChat);
  const importPlan = useAppStore((state) => state.importPlan);
  const removeMemory = useAppStore((state) => state.removeMemory);
  const [input, setInput] = useState("");
  const [goal, setGoal] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planDraft, setPlanDraft] = useState<LearningPlanDraft | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const provider = snapshot.providers[0];
  const profile = snapshot.companionProfile;
  const conversationId = snapshot.messages.at(-1)?.conversationId;

  useEffect(() => {
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: "smooth"
    });
  }, [snapshot.messages, pending]);

  const submitContent = async (content: string) => {
    if (!provider || !content.trim() || pending) return;
    setPending(content.trim());
    try {
      await sendChat({
        providerId: provider.id,
        conversationId,
        content: content.trim()
      });
      setInput("");
    } finally {
      setPending(null);
    }
  };

  const submitMessage = (event: FormEvent) => {
    event.preventDefault();
    void submitContent(input);
  };

  const requestPlan = async () => {
    if (!goal.trim() || !provider || planLoading) return;
    setPlanLoading(true);
    try {
      const draft = await generateLearningPlan(provider.id, goal.trim());
      setPlanDraft(draft);
    } finally {
      setPlanLoading(false);
    }
  };

  return (
    <>
      <div className="companion-layout">
      <section className="chat-panel panel">
        <div className="companion-profile">
          <span className="companion-avatar">
            <Bot size={24} />
          </span>
          <div>
            <h2>{profile.name}</h2>
            <p>
              {provider
                ? `${provider.name} · 记住你的学习节奏`
                : "等待连接模型"}
            </p>
          </div>
          <span className={`connection-badge ${provider ? "online" : ""}`}>
            <i />
            {provider ? "已连接" : "未配置"}
          </span>
        </div>

        <div className="message-list" aria-live="polite" ref={listRef}>
          {snapshot.messages.length === 0 && (
            <article className="message assistant">
              <span className="message-avatar" aria-hidden="true">
                <Sparkles size={15} />
              </span>
              <p>
                你好，我是{profile.name}
                。告诉我你正在学什么、哪里卡住了，或者直接让我把一个目标拆成番茄学习步骤。
              </p>
            </article>
          )}
          {snapshot.messages.map((message) => (
            <article key={message.id} className={`message ${message.role}`}>
              {message.role === "assistant" && (
                <span className="message-avatar" aria-hidden="true">
                  <Sparkles size={15} />
                </span>
              )}
              <p>{message.content}</p>
            </article>
          ))}
          {pending && (
            <>
              <article className="message user">
                <p>{pending}</p>
              </article>
              <article className="message assistant is-thinking">
                <span className="message-avatar" aria-hidden="true">
                  <Loader2 size={15} className="spin-icon" />
                </span>
                <p>{profile.name}正在结合对话和记忆思考…</p>
              </article>
            </>
          )}
        </div>

        <form className="chat-composer" onSubmit={submitMessage}>
          <label>
            <span className="sr-only">发送给学习伙伴</span>
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={
                provider
                  ? `告诉${profile.name}你正在学习什么…`
                  : "请先在设置中选择模型服务并输入 API Key"
              }
              rows={2}
              disabled={!provider || Boolean(pending)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
            />
          </label>
          <button
            type="submit"
            className="send-button"
            aria-label="发送消息"
            disabled={!provider || !input.trim() || Boolean(pending)}
          >
            {pending ? <Loader2 size={18} className="spin-icon" /> : <Send size={18} />}
          </button>
        </form>
      </section>

      <aside className="companion-rail">
        <section className="plan-panel panel">
          <p className="eyebrow">LEARNING PLAN</p>
          <h2>把目标拆成番茄步骤</h2>
          <p>
            伙伴会结合你的历史节奏，为每一步给出行动、完成标准和建议番茄数。
          </p>
          <label className="field">
            <span>我想学习</span>
            <input
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
              placeholder="例如：用 Python 做数据分析"
              disabled={!provider || Boolean(pending)}
            />
          </label>
          <button
            type="button"
            className="button button-primary full-width"
            onClick={() => void requestPlan()}
            disabled={
              !provider || !goal.trim() || Boolean(pending) || planLoading
            }
          >
            {planLoading ? (
              <>
                <Loader2 size={18} className="spin-icon" />
                正在生成可导入任务
              </>
            ) : (
              <>
                请伙伴拆解并导入
                <ArrowRight size={18} />
              </>
            )}
          </button>
          {!provider && (
            <button
              type="button"
              className="setup-callout"
              onClick={() => setPage("settings")}
            >
              <Bot size={19} />
              <span>
                <strong>连接你的模型</strong>
                <small>选择 DeepSeek 等服务并输入密钥</small>
              </span>
              <ArrowRight size={17} />
            </button>
          )}
        </section>

        <section className="panel memory-panel">
          <div className="memory-heading">
            <Brain size={19} />
            <div>
              <h2>伙伴记忆</h2>
              <p>每 12 条消息压缩一次，可随时删除。</p>
            </div>
          </div>
          {snapshot.memories.length ? (
            <div className="memory-list">
              {snapshot.memories.slice(0, 8).map((memory) => (
                <article key={memory.id}>
                  <span>{memory.kind.replace("_", " ")}</span>
                  <p>{memory.content}</p>
                  <button
                    type="button"
                    onClick={() => void removeMemory(memory.id)}
                    aria-label={`删除记忆：${memory.content}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div className="memory-empty">
              <Brain size={23} />
              <p>长期互动后，稳定的学习偏好和目标会出现在这里。</p>
            </div>
          )}
        </section>
      </aside>
      </div>
      {planDraft && (
        <PlanImportDialog
          draft={planDraft}
          projects={snapshot.projects}
          onClose={() => setPlanDraft(null)}
          onImport={async (plan) => {
            await importPlan(plan);
            setPlanDraft(null);
            setGoal("");
            setPage("tasks");
          }}
        />
      )}
    </>
  );
}
