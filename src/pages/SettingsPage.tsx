import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Bot,
  CheckCircle2,
  Database,
  KeyRound,
  Loader2,
  LockKeyhole,
  Plus,
  ShieldCheck,
  Wifi
} from "lucide-react";
import {
  isTauriRuntime,
  loadCompanionStyles,
  loadProviderCatalog,
  testProviderConnection
} from "../lib/bridge";
import { useAppStore } from "../store/useAppStore";
import type {
  CompanionStyle,
  CompanionStyleId,
  ProviderCatalogItem
} from "../types";

export function SettingsPage() {
  const snapshot = useAppStore((state) => state.snapshot);
  const saveProvider = useAppStore((state) => state.saveProvider);
  const saveCompanion = useAppStore((state) => state.saveCompanion);
  const saveProactiveSettings = useAppStore(
    (state) => state.saveProactiveSettings
  );
  const [catalog, setCatalog] = useState<ProviderCatalogItem[]>([]);
  const [styles, setStyles] = useState<CompanionStyle[]>([]);
  const [catalogId, setCatalogId] = useState("deepseek");
  const [name, setName] = useState("我的 DeepSeek");
  const [apiKey, setApiKey] = useState("");
  const [customModel, setCustomModel] = useState("");
  const [saved, setSaved] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [companionName, setCompanionName] = useState(
    snapshot.companionProfile.name
  );
  const [styleId, setStyleId] = useState<CompanionStyleId>(
    snapshot.companionProfile.styleId
  );
  const [profileSaved, setProfileSaved] = useState(false);
  const [proactiveEnabled, setProactiveEnabled] = useState(
    snapshot.proactiveSettings.enabled
  );
  const [proactiveFrequency, setProactiveFrequency] = useState(
    snapshot.proactiveSettings.frequency
  );
  const native = isTauriRuntime();

  useEffect(() => {
    void Promise.all([loadProviderCatalog(), loadCompanionStyles()]).then(
      ([providers, companionStyles]) => {
        setCatalog(providers);
        setStyles(companionStyles);
        setCustomModel(
          providers.find((provider) => provider.id === "deepseek")?.defaultModel ??
            ""
        );
      }
    );
  }, []);

  const selected = useMemo(
    () => catalog.find((item) => item.id === catalogId),
    [catalog, catalogId]
  );

  const changeProvider = (nextId: string) => {
    const next = catalog.find((item) => item.id === nextId);
    setCatalogId(nextId);
    setName(next ? `我的 ${next.name}` : "我的模型");
    setCustomModel(next?.defaultModel ?? "");
    setApiKey("");
    setSaved(false);
    setTestMessage(null);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !selected) return;
    await saveProvider({
      name,
      catalogId,
      apiKey,
      customModel: customModel.trim() || selected.defaultModel
    });
    setApiKey("");
    setSaved(true);
  };

  const handleTest = async (providerId: string) => {
    setTestingId(providerId);
    setTestMessage(null);
    try {
      const reply = await testProviderConnection(providerId);
      setTestMessage(reply || "连接成功");
    } catch (error) {
      setTestMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setTestingId(null);
    }
  };

  const handleCompanionSave = async (event: FormEvent) => {
    event.preventDefault();
    await Promise.all([
      saveCompanion(companionName, styleId),
      saveProactiveSettings({
        enabled: proactiveEnabled,
        frequency: proactiveFrequency
      })
    ]);
    setProfileSaved(true);
  };

  return (
    <div className="settings-layout">
      <div className="settings-column">
        <section className="panel settings-section">
          <div className="settings-heading">
            <span className="section-icon">
              <KeyRound size={20} />
            </span>
            <div>
              <h2>模型连接</h2>
              <p>选择服务商并输入密钥，其余连接参数已在程序底层配置好。</p>
            </div>
          </div>

          <form className="provider-form" onSubmit={handleSubmit}>
            <label className="field">
              <span>模型服务商</span>
              <select
                value={catalogId}
                onChange={(event) => changeProvider(event.target.value)}
              >
                {catalog.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>连接名称</span>
              <input value={name} onChange={(event) => setName(event.target.value)} />
            </label>

            {selected && (
              <div className="provider-description field-span-2">
                <strong>{selected.name}</strong>
                <span>{selected.description}</span>
                <small>程序默认模型：{selected.defaultModel}</small>
              </div>
            )}

            <label className="field field-span-2">
              <span>API Key</span>
              <input
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder={
                  selected?.requiresKey === false
                    ? "本地 Ollama 不需要密钥"
                    : "粘贴服务商提供的 API Key"
                }
                autoComplete="off"
                disabled={!native || selected?.requiresKey === false}
              />
            </label>

            <label className="field field-span-2">
              <span>模型 ID / 名称</span>
              <input
                value={customModel}
                onChange={(event) => {
                  setCustomModel(event.target.value);
                  setSaved(false);
                }}
                placeholder={selected?.defaultModel}
                spellCheck={false}
              />
              <small className="field-help">
                填写服务商控制台中的具体模型名称，例如 deepseek-chat。
              </small>
            </label>

            <div className="secure-hint field-span-2">
              <LockKeyhole size={17} />
              <p>
                {native
                  ? "密钥只写入 Windows Credential Manager，不进入 SQLite、前端状态、日志或导出文件。"
                  : "这是界面预览。安装后的 Windows 程序才会启用系统密钥库和真实模型连接。"}
              </p>
            </div>
            <button
              type="submit"
              className="button button-primary field-span-2"
              disabled={
                !selected ||
                !customModel.trim() ||
                (!apiKey && selected.requiresKey)
              }
            >
              {saved ? <CheckCircle2 size={18} /> : <Plus size={18} />}
              {saved ? "连接已安全保存" : "保存模型连接"}
            </button>
          </form>

          {snapshot.providers.length > 0 && (
            <div className="provider-list">
              <h3>已配置连接</h3>
              {snapshot.providers.map((provider) => (
                <article key={provider.id}>
                  <span className="provider-logo">
                    <KeyRound size={18} />
                  </span>
                  <div>
                    <strong>{provider.name}</strong>
                    <p>{provider.defaultModel}</p>
                  </div>
                  <button
                    type="button"
                    className="connection-test"
                    onClick={() => void handleTest(provider.id)}
                    disabled={testingId === provider.id}
                  >
                    {testingId === provider.id ? (
                      <Loader2 size={14} className="spin-icon" />
                    ) : (
                      <Wifi size={14} />
                    )}
                    测试
                  </button>
                  <span className={`secret-status ${provider.hasSecret ? "ok" : ""}`}>
                    {provider.providerType === "ollama"
                      ? "本地"
                      : provider.hasSecret
                        ? "密钥已保存"
                        : "未保存密钥"}
                  </span>
                </article>
              ))}
              {testMessage && <p className="connection-result">{testMessage}</p>}
            </div>
          )}
        </section>

        <section className="panel settings-section">
          <div className="settings-heading">
            <span className="section-icon">
              <Bot size={20} />
            </span>
            <div>
              <h2>学习伙伴</h2>
              <p>姓名和初始风格会写入底层身份提示词，并随长期互动逐渐个性化。</p>
            </div>
          </div>
          <form className="companion-settings" onSubmit={handleCompanionSave}>
            <label className="field">
              <span>伙伴姓名</span>
              <input
                value={companionName}
                maxLength={20}
                onChange={(event) => {
                  setCompanionName(event.target.value);
                  setProfileSaved(false);
                }}
              />
            </label>
            <fieldset className="style-picker">
              <legend>初始风格</legend>
              {styles.map((style) => (
                <label
                  key={style.id}
                  className={styleId === style.id ? "is-selected" : ""}
                >
                  <input
                    type="radio"
                    name="companion-style"
                    value={style.id}
                    checked={styleId === style.id}
                    onChange={() => {
                      setStyleId(style.id);
                      setProfileSaved(false);
                    }}
                  />
                  <span>
                    <strong>{style.name}</strong>
                    <small>{style.description}</small>
                  </span>
                </label>
              ))}
            </fieldset>
            <div className="proactive-settings">
              <label className="proactive-toggle">
                <input
                  type="checkbox"
                  checked={proactiveEnabled}
                  onChange={(event) => {
                    setProactiveEnabled(event.target.checked);
                    setProfileSaved(false);
                  }}
                />
                <span>
                  <strong>完成番茄后主动互动</strong>
                  <small>
                    伙伴会结合最近任务询问掌握情况；仅触发一次简短模型请求。
                  </small>
                </span>
              </label>
              <label className="field proactive-frequency">
                <span>互动频率</span>
                <select
                  value={proactiveFrequency}
                  disabled={!proactiveEnabled}
                  onChange={(event) => {
                    setProactiveFrequency(Number(event.target.value));
                    setProfileSaved(false);
                  }}
                >
                  {[1, 2, 3, 4, 5, 6].map((count) => (
                    <option key={count} value={count}>
                      每完成 {count} 颗番茄
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button type="submit" className="button button-secondary">
              {profileSaved ? <CheckCircle2 size={18} /> : <Bot size={18} />}
              {profileSaved ? "伙伴设置已保存" : "保存伙伴设置"}
            </button>
          </form>
        </section>
      </div>

      <aside className="settings-rail">
        <section className="panel privacy-card">
          <ShieldCheck size={25} />
          <h2>隐私原则</h2>
          <ul>
            <li>任务、番茄、对话和记忆都在本机 SQLite</li>
            <li>API Key 使用 Windows 系统密钥库</li>
            <li>计时和任务完全不依赖 AI</li>
            <li>记忆可查看并逐条删除</li>
          </ul>
        </section>
        <section className="panel data-card">
          <Database size={22} />
          <div>
            <h2>本地数据引擎</h2>
            <p>{native ? "SQLite + Windows Credential Manager" : "桌面端预览"}</p>
          </div>
          <span className={`runtime-badge ${native ? "native" : ""}`}>
            {native ? "本地运行" : "预览"}
          </span>
        </section>
      </aside>
    </div>
  );
}
