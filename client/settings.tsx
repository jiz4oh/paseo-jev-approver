import { useState } from "react";
import { Text, View, TextInput, Pressable, ScrollView } from "react-native";
import { useRpc, useSettings } from "@getpaseo/plugin/client";
import { SettingsSection, SettingsCard, SettingsSelect, SettingsInput, SettingsSwitch, SettingsAction, SettingsRow } from "@getpaseo/plugin/client/ui";
import { usePluginT } from "./i18n";
import { approverSettings, credentialStatus, saveCredential, clearCredential } from "../shared/config";
import { DEFAULT_REVIEW_PROMPT, DEFAULT_RISK_THRESHOLD } from "../shared/review-policy";

type Tab = "general" | "model" | "policy" | "history";
type ModelDraft = { provider: "zen" | "typesafe" | "openrouter" | "vercel" | "custom"; model: string; customEndpoint: string; timeout: string; apiKeyEnv: string };
type PolicyDraft = { riskPercent: string; reviewPrompt: string };
const modelOf = (v: any): ModelDraft => ({ provider: v.provider, model: v.model, customEndpoint: v.customEndpoint, timeout: String(v.timeoutMs), apiKeyEnv: v.apiKeyEnv });
const policyOf = (v: any): PolicyDraft => ({ riskPercent: String(v.riskThreshold * 100), reviewPrompt: v.reviewPrompt });
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const suggestedModel = (provider: ModelDraft["provider"]) => provider === "zen" ? "jev-1.13-free" : provider === "vercel" ? "typesafe-ai/jev" : "jev-1.13";

function Editor({ state, onOpenHistory, colors }: { state: any; onOpenHistory: () => void; colors: { foreground: string; foregroundMuted: string; border: string; control: string; accent?: string } }) {
  const t = usePluginT();
  const [tab, setTab] = useState<Tab>("general");
  const [model, setModel] = useState<ModelDraft>(() => modelOf(state.values));
  const [policy, setPolicy] = useState<PolicyDraft>(() => policyOf(state.values));
  const [modelBase, setModelBase] = useState<ModelDraft>(() => modelOf(state.values));
  const [policyBase, setPolicyBase] = useState<PolicyDraft>(() => policyOf(state.values));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const saveKey = useRpc(saveCredential);
  const removeKey = useRpc(clearCredential);
  const keyStatus = useRpc(credentialStatus);
  const modelDirty = !same(model, modelBase);
  const policyDirty = !same(policy, policyBase);

  async function persist(fields: Record<string, unknown>) {
    if (saving) return false;
    setSaving(true);
    setMessage("");
    try {
      // Only the active tab's fields are patched into the latest persisted values.
      // Drafts from other tabs are never included in this write.
      const ok = await state.save({ ...state.values, ...fields }, state.revision);
      setMessage(ok ? t("Saved") : t("Save failed; reload and retry"));
      return ok;
    } catch {
      setMessage(t("Save failed; reload and retry"));
      return false;
    } finally {
      setSaving(false);
    }
  }
  async function saveModel() {
    const timeoutMs = Number(model.timeout);
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 15000) {
      setMessage(t("Timeout must be between 1000 and 15000 ms"));
      return;
    }
    if (!model.model.trim() || (model.provider === "custom" && !model.customEndpoint.trim())) {
      setMessage(t("Complete required model fields"));
      return;
    }
    const fields = { provider: model.provider, model: model.model.trim(), customEndpoint: model.customEndpoint.trim(), timeoutMs, apiKeyEnv: model.apiKeyEnv.trim() };
    if (await persist(fields)) {
      const saved = { ...model, model: fields.model, customEndpoint: fields.customEndpoint, timeout: String(timeoutMs), apiKeyEnv: fields.apiKeyEnv };
      setModel(saved);
      setModelBase(saved);
    }
  }
  async function savePolicy() {
    const n = Number(policy.riskPercent);
    if (!policy.riskPercent.trim() || !Number.isFinite(n) || n < 0 || n > 100) {
      setMessage(t("Risk threshold must be between 0% and 100%"));
      return;
    }
    const prompt = policy.reviewPrompt.trim();
    if (prompt.length < 20 || prompt.length > 8000) {
      setMessage(t("Review prompt must contain 20–8000 characters"));
      return;
    }
    if (await persist({ riskThreshold: n / 100, reviewPrompt: prompt })) {
      const saved = { riskPercent: String(n), reviewPrompt: prompt };
      setPolicy(saved);
      setPolicyBase(saved);
    }
  }
  const tabs: { id: Tab; text: string; dirty: boolean }[] = [
    { id: "general", text: t("General"), dirty: false },
    { id: "model", text: t("Model"), dirty: modelDirty },
    { id: "policy", text: t("Review policy"), dirty: policyDirty },
    { id: "history", text: t("Review history"), dirty: false },
  ];
  const dirty = tab === "model" ? modelDirty : tab === "policy" ? policyDirty : false;
  const saveCurrent = tab === "model" ? saveModel : savePolicy;
  return <View style={{ gap: 16, paddingBottom: 24 }}>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
      {tabs.map(item => <Pressable key={item.id} accessibilityRole="tab" accessibilityState={{ selected: tab === item.id }}
        onPress={() => { setTab(item.id); setMessage(""); }}
        style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 9, borderWidth: 1, borderColor: tab === item.id ? (colors.accent || colors.foreground) : colors.border }}>
        <Text style={{ color: tab === item.id ? (colors.accent || colors.foreground) : colors.foregroundMuted, fontWeight: tab === item.id ? "600" : "400" }}>
          {item.text}{item.dirty ? " •" : ""}
        </Text>
      </Pressable>)}
    </ScrollView>
    {tab === "general" && <>
      <SettingsSection title={t("Interface language")}><SettingsCard>
        <SettingsSelect label={t("Language")} value={state.values.language ?? "auto"}
          options={[{ label: t("Automatic"), value: "auto" }, { label: t("English"), value: "en" }, { label: t("Simplified Chinese"), value: "zh-CN" }]}
          onValueChange={language => { void persist({ language }); }}/>
        <SettingsSwitch label={t("Dry run (never auto-approve)")} value={state.values.dryRun}
          onValueChange={dryRun => { void persist({ dryRun }); }}/>
      </SettingsCard></SettingsSection>
    </>}
    {tab === "model" && <>
      <SettingsSection title={t("Jev provider")}><SettingsCard>
        <SettingsSelect label={t("Provider")} value={model.provider}
          options={[{ label:t("OpenCode Zen (default)"), value:"zen" },{ label:t("TypeSafe AI"),value:"typesafe" },{ label:t("OpenRouter"),value:"openrouter" },{ label:t("Vercel AI Gateway"),value:"vercel" },{ label:t("Custom System One"),value:"custom" }]}
          onValueChange={provider => setModel(prev => ({ ...prev, provider, model: suggestedModel(provider) }))}/>
        <SettingsInput label={t("Model ID")} initialValue={model.model} onChangeText={value => setModel(prev => ({ ...prev, model: value }))} placeholder="jev-1.13-free"/>
        {model.provider === "custom" && <SettingsInput label={t("System One endpoint URL (HTTPS)")}
          initialValue={model.customEndpoint} onChangeText={value => setModel(prev => ({ ...prev, customEndpoint: value }))} placeholder="https://example.com/v1/systemone"/>}
        <SettingsInput label={t("Request timeout (milliseconds, 1000–15000)")}
          initialValue={model.timeout} onChangeText={value => setModel(prev => ({ ...prev, timeout: value }))} placeholder="6500"/>
        <SettingsInput label={t("Alternative: API key environment variable name")}
          initialValue={model.apiKeyEnv} onChangeText={value => setModel(prev => ({ ...prev, apiKeyEnv: value }))} placeholder="OPENCODE_API_KEY"/>
      </SettingsCard></SettingsSection>
      <SettingsSection title={t("Credentials (daemon-side)")}><SettingsCard>
        <SettingsInput label={t("API key")} placeholder={t("Paste key (not shown after saving)")} secureTextEntry onChangeText={setApiKey}/>
        <SettingsAction label={t("API key")} actionLabel={t("Save key")} onPress={() => {
          void saveKey({ provider: model.provider, apiKey }).then(() => { setApiKey(""); setHasKey(true); setMessage(t("Credential saved on daemon")); })
            .catch(() => setMessage(t("Credential save failed")));
        }}/>
        <SettingsAction label={t("Existing credential")} actionLabel={t("Check status")}
          onPress={() => { void keyStatus({ provider: model.provider }).then(result => setHasKey(result.configured)).catch(() => setMessage(t("Status check failed"))); }}/>
        <SettingsAction label={t("Remove credential")} actionLabel={t("Delete key")}
          onPress={() => { void removeKey({ provider: model.provider }).then(() => { setHasKey(false); setMessage(t("Credential removed")); }).catch(() => setMessage(t("Delete failed"))); }}/>
      </SettingsCard></SettingsSection>
      {hasKey !== null && <Text style={{ color: colors.foregroundMuted }}>{hasKey ? t("Key configured") : t("No stored key")}</Text>}
    </>}
    {tab === "policy" && <>
      <SettingsSection title={t("Review policy")}><SettingsCard>
        <SettingsInput label={t("Maximum risk (%) · 0–100")} initialValue={policy.riskPercent}
          onChangeText={value => setPolicy(prev => ({ ...prev, riskPercent: value }))} placeholder="1"/>
      </SettingsCard></SettingsSection>
      <Text style={{ color: colors.foreground }}>{t("Review prompt (20–8000 characters)")}</Text>
      <TextInput multiline numberOfLines={8} value={policy.reviewPrompt}
        onChangeText={value => setPolicy(prev => ({ ...prev, reviewPrompt: value }))}
        accessibilityLabel={t("Review prompt")} placeholder={t("Describe what Jev should consider risky...")}
        style={{ minHeight: 180, width: "100%", color: colors.foreground, backgroundColor: colors.control,
          textAlignVertical: "top", padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 10 }}/>
      <Pressable accessibilityRole="button" onPress={() => setPolicy({ riskPercent: String(DEFAULT_RISK_THRESHOLD * 100), reviewPrompt: DEFAULT_REVIEW_PROMPT })}>
        <Text style={{ color: colors.accent || colors.foreground }}>{t("Reset defaults")}</Text>
      </Pressable>
      <Text style={{ color: colors.foregroundMuted, fontSize: 12, lineHeight: 18 }}>{t("Local safety filters and mandatory safety instructions always remain enabled. Risk scores are model estimates, not calibrated real-world probabilities.")}</Text>
    </>}
    {tab === "history" && <SettingsSection title={t("Review history")}><SettingsCard>
      <SettingsAction label={t("Approval records")} actionLabel={t("View history")} onPress={onOpenHistory}/>
    </SettingsCard></SettingsSection>}
    {(tab === "model" || tab === "policy") && <View style={{ gap: 10 }}>
      {dirty && <Text accessibilityRole="alert" style={{ color: "#d97706" }}>{t("Unsaved changes")}</Text>}
      <View style={{ alignItems: "flex-end" }}>
        <Pressable accessibilityRole="button" disabled={!dirty || saving} onPress={() => { void saveCurrent(); }}
          style={{ paddingHorizontal: 22, paddingVertical: 12, borderRadius: 9, backgroundColor: colors.accent || colors.foreground, opacity: !dirty || saving ? 0.45 : 1 }}>
          <Text style={{ color: "#fff", fontWeight: "600" }}>{saving ? t("Saving…") : t("Save changes")}</Text>
        </Pressable>
      </View>
    </View>}
    {!!(message || state.saveError) && <Text accessibilityRole="alert" style={{ color: colors.foreground }}>{message || String(state.saveError)}</Text>}
  </View>;
}

export function ApproverSettings({ onOpenHistory, theme }: { onOpenHistory: () => void; theme: { colors: { foreground: string; foregroundMuted: string; border: string; control: string; accent?: string } } }) {
  const state = useSettings(approverSettings);
  const t = usePluginT();
  if (state.status !== "ready") return <Text>{t("Settings:")} {state.status}. {t("Reload or reset if invalid.")}</Text>;
  return <Editor state={state} onOpenHistory={onOpenHistory} colors={theme.colors}/>;
}
