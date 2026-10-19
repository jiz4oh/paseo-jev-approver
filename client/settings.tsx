import { useState } from "react";
import { usePluginT } from "./i18n";
import { Text, View, TextInput } from "react-native";
import { useRpc, useSettings } from "@getpaseo/plugin/client";
import { SettingsSection, SettingsCard, SettingsSelect, SettingsInput, SettingsSwitch, SettingsAction } from "@getpaseo/plugin/client/ui";
import { approverSettings, credentialStatus, saveCredential, clearCredential } from "../shared/config";
import { DEFAULT_REVIEW_PROMPT, DEFAULT_RISK_THRESHOLD } from "../shared/review-policy";

function Editor({ state, onOpenHistory }: { state: any; onOpenHistory: () => void }) {
  const t = usePluginT();
  const [key, setKey] = useState("");
  const [message, setMessage] = useState("");
  const [model, setModel] = useState(state.values.model);
  const [endpoint, setEndpoint] = useState(state.values.customEndpoint);
  const [env, setEnv] = useState(state.values.apiKeyEnv);
  const [timeout, setTimeoutValue] = useState(String(state.values.timeoutMs ?? 6500));
  const [riskPercent, setRiskPercent] = useState(String((state.values.riskThreshold ?? DEFAULT_RISK_THRESHOLD) * 100));
  const [reviewPrompt, setReviewPrompt] = useState(state.values.reviewPrompt ?? DEFAULT_REVIEW_PROMPT);
  const saveKey = useRpc(saveCredential);
  const removeKey = useRpc(clearCredential);
  const status = useRpc(credentialStatus);
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const provider = state.values.provider;
  async function persist(fields: Partial<typeof state.values>) {
    const ok = await state.save({ ...state.values, ...fields }, state.revision);
    setMessage(ok ? t("Saved") : t("Save failed; reload and retry"));
  }
  return <View>
    <SettingsSection title={t("Review history")}>
      <SettingsCard>
        <SettingsAction label={t("Approval records")} actionLabel={t("View history")} onPress={onOpenHistory}/>
      </SettingsCard>
    </SettingsSection>
    <SettingsSection title={t("Jev provider")}>
      <SettingsCard>
        <SettingsSelect label={t("Provider")} value={provider}
          options={[{label:t("OpenCode Zen (default)"),value:"zen"},{label:t("TypeSafe AI"),value:"typesafe"},{label:t("OpenRouter"),value:"openrouter"},{label:t("Vercel AI Gateway"),value:"vercel"},{label:t("Custom System One"),value:"custom"}]}
          onValueChange={(value) => { void persist({ provider: value as typeof provider, model: value === "zen" ? "jev-1.13-free" : value === "openrouter" ? "jev-1.13" : value === "vercel" ? "typesafe-ai/jev" : "jev-1.13" }); setHasKey(null); setModel(value === "zen" ? "jev-1.13-free" : "jev-1.13"); }}/>
        <SettingsInput label={t("Model ID")} initialValue={model} onChangeText={setModel} placeholder="jev-1.13-free" />
        <SettingsAction label={t("Model")} actionLabel={t("Save model")} onPress={() => void persist({ model })} />
        {provider === "custom" ? <>
          <SettingsInput label={t("System One endpoint URL (HTTPS)")} initialValue={endpoint} onChangeText={setEndpoint}
            placeholder="https://example.com/v1/systemone" />
          <SettingsAction label={t("Endpoint")} actionLabel={t("Save endpoint")} onPress={() => void persist({ customEndpoint: endpoint })}/>
        </> : null}
        <SettingsInput label={t("Request timeout (milliseconds, 1000–15000)")} initialValue={timeout} onChangeText={setTimeoutValue} placeholder="6500" />
        <SettingsAction label={t("Timeout")} actionLabel={t("Save timeout")} onPress={() => { const n = Number(timeout); if (!Number.isInteger(n) || n < 1000 || n > 15000) { setMessage(t("Timeout must be between 1000 and 15000 ms")); return; } void persist({ timeoutMs: n }); }}/>
        <SettingsSwitch label={t("Dry run (never auto-approve)")} value={state.values.dryRun}
          onValueChange={(dryRun) => void persist({ dryRun })} />
      </SettingsCard>
    </SettingsSection>
    <SettingsSection title={t("Review policy")}>
      <SettingsCard>
        <SettingsInput label={t("Maximum risk (%) · 0–10")} initialValue={riskPercent} onChangeText={setRiskPercent} placeholder="1" />
        <SettingsAction label={t("Risk threshold")} actionLabel={t("Save threshold")} onPress={() => {
          const n = Number(riskPercent);
          if (!Number.isFinite(n) || n < 0 || n > 10 || riskPercent.trim() === "") {
            setMessage(t("Risk threshold must be between 0% and 10%")); return;
          }
          void persist({ riskThreshold: n / 100 });
        }}/>
        <Text>{t("Review prompt (20–8000 characters)")}</Text>
        <TextInput multiline numberOfLines={6} value={reviewPrompt}
          onChangeText={setReviewPrompt} accessibilityLabel={t("Review prompt")}
          placeholder={t("Describe what Jev should consider risky...")}
          style={{ minHeight: 120, textAlignVertical: "top", padding: 12, borderWidth: 1, borderColor: "#999", borderRadius: 8 }} />
        <SettingsAction label={t("Review prompt")} actionLabel={t("Save prompt")} onPress={() => {
          const prompt = reviewPrompt.trim();
          if (prompt.length < 20 || prompt.length > 8000) {
            setMessage(t("Review prompt must contain 20–8000 characters")); return;
          }
          void persist({ reviewPrompt: prompt });
        }}/>
        <SettingsAction label={t("Default review policy")} actionLabel={t("Reset defaults")} onPress={() => {
          setRiskPercent(String(DEFAULT_RISK_THRESHOLD * 100));
          setReviewPrompt(DEFAULT_REVIEW_PROMPT);
          void persist({ riskThreshold: DEFAULT_RISK_THRESHOLD, reviewPrompt: DEFAULT_REVIEW_PROMPT });
        }}/>
      </SettingsCard>
      <Text>{t("Local safety filters and mandatory safety instructions always remain enabled. Risk scores are model estimates, not calibrated real-world probabilities.")}</Text>
    </SettingsSection>
    <SettingsSection title={t("Credentials (daemon-side)")}>
      <SettingsCard>
        <SettingsInput label={t("API key")} placeholder={t("Paste key (not shown after saving)")}
          secureTextEntry onChangeText={setKey}/>
        <SettingsAction label={t("API key")} actionLabel={t("Save key")} onPress={() => {
          void saveKey({ provider, apiKey: key }).then(() => {setKey("");setHasKey(true);setMessage(t("Credential saved on daemon"));})
          .catch(() => setMessage(t("Credential save failed")));
        }}/>
        <SettingsAction label={t("Existing credential")} actionLabel={t("Check status")} onPress={() => {
          void status({provider}).then(result=>setHasKey(result.configured)).catch(()=>setMessage(t("Status check failed")));
        }}/>
        <SettingsAction label={t("Remove credential")} actionLabel={t("Delete key")} onPress={() => {
          void removeKey({provider}).then(()=>{setHasKey(false);setMessage(t("Credential removed"));}).catch(()=>setMessage(t("Delete failed")));
        }}/>
        <SettingsInput label={t("Alternative: API key environment variable name")} initialValue={env}
          placeholder="OPENCODE_API_KEY" onChangeText={setEnv}/>
        <SettingsAction label={t("Environment")} actionLabel={t("Save variable name")} onPress={() => void persist({ apiKeyEnv: env })}/>
      </SettingsCard>
    </SettingsSection>
    <Text>{hasKey === null ? "" : hasKey ? t("Key configured") : t("No stored key")}</Text>
    <Text>{message || String(state.saveError ?? "") || ""}</Text>
  </View>;
}

export function ApproverSettings({ onOpenHistory }: { onOpenHistory: () => void }) {
  const state = useSettings(approverSettings);
  const t = usePluginT();
  if (state.status !== "ready") return <Text>{t("Settings:")} {state.status}. {t("Reload or reset if invalid.")}</Text>;
  return <Editor key={state.values.provider} state={state} onOpenHistory={onOpenHistory}/>;
}
