import { useState } from "react";
import { Text, View } from "react-native";
import { useRpc, useSettings } from "@getpaseo/plugin/client";
import { SettingsSection, SettingsCard, SettingsSelect, SettingsInput, SettingsSwitch, SettingsAction } from "@getpaseo/plugin/client/ui";
import { approverSettings, credentialStatus, saveCredential, clearCredential } from "../shared/config";

function Editor({ state }: { state: any }) {
  const [key, setKey] = useState("");
  const [message, setMessage] = useState("");
  const [model, setModel] = useState(state.values.model);
  const [endpoint, setEndpoint] = useState(state.values.customEndpoint);
  const [env, setEnv] = useState(state.values.apiKeyEnv);
  const saveKey = useRpc(saveCredential);
  const removeKey = useRpc(clearCredential);
  const status = useRpc(credentialStatus);
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const provider = state.values.provider;
  async function persist(fields: Partial<typeof state.values>) {
    const ok = await state.save({ ...state.values, ...fields }, state.revision);
    setMessage(ok ? "Saved" : "Save failed; reload and retry");
  }
  return <View>
    <SettingsSection title="Jev provider">
      <SettingsCard>
        <SettingsSelect label="Provider" value={provider}
          options={[{label:"OpenCode Zen (default)",value:"zen"},{label:"TypeSafe AI",value:"typesafe"},{label:"OpenRouter",value:"openrouter"},{label:"Vercel AI Gateway",value:"vercel"},{label:"Custom System One",value:"custom"}]}
          onValueChange={(value) => { void persist({ provider: value as typeof provider, model: value === "zen" ? "jev-1.13-free" : value === "openrouter" ? "jev-1.13" : value === "vercel" ? "typesafe-ai/jev" : "jev-1.13" }); setHasKey(null); setModel(value === "zen" ? "jev-1.13-free" : "jev-1.13"); }}/>
        <SettingsInput label="Model ID" initialValue={model} onChangeText={setModel} placeholder="jev-1.13-free" />
        <SettingsAction label="Model" actionLabel="Save model" onPress={() => void persist({ model })} />
        {provider === "custom" ? <>
          <SettingsInput label="System One endpoint URL (HTTPS)" initialValue={endpoint} onChangeText={setEndpoint}
            placeholder="https://example.com/v1/systemone" />
          <SettingsAction label="Endpoint" actionLabel="Save endpoint" onPress={() => void persist({ customEndpoint: endpoint })}/>
        </> : null}
        <SettingsSwitch label="Dry run (never auto-approve)" value={state.values.dryRun}
          onValueChange={(dryRun) => void persist({ dryRun })} />
      </SettingsCard>
    </SettingsSection>
    <SettingsSection title="Credentials (daemon-side)">
      <SettingsCard>
        <SettingsInput label="API key" placeholder="Paste key (not shown after saving)"
          secureTextEntry onChangeText={setKey}/>
        <SettingsAction label="API key" actionLabel="Save key" onPress={() => {
          void saveKey({ provider, apiKey: key }).then(() => {setKey("");setHasKey(true);setMessage("Credential saved on daemon");})
          .catch(() => setMessage("Credential save failed"));
        }}/>
        <SettingsAction label="Existing credential" actionLabel="Check status" onPress={() => {
          void status({provider}).then(result=>setHasKey(result.configured)).catch(()=>setMessage("Status check failed"));
        }}/>
        <SettingsAction label="Remove credential" actionLabel="Delete key" onPress={() => {
          void removeKey({provider}).then(()=>{setHasKey(false);setMessage("Credential removed");}).catch(()=>setMessage("Delete failed"));
        }}/>
        <SettingsInput label="Alternative: API key environment variable name" initialValue={env}
          placeholder="OPENCODE_API_KEY" onChangeText={setEnv}/>
        <SettingsAction label="Environment" actionLabel="Save variable name" onPress={() => void persist({ apiKeyEnv: env })}/>
      </SettingsCard>
    </SettingsSection>
    <Text>{hasKey === null ? "" : hasKey ? "Key configured" : "No stored key"}</Text>
    <Text>{message || String(state.saveError ?? "") || ""}</Text>
  </View>;
}

export function ApproverSettings() {
  const state = useSettings(approverSettings);
  if (state.status !== "ready") return <Text>Settings: {state.status}. Reload or reset if invalid.</Text>;
  return <Editor key={state.values.provider} state={state}/>;
}
