import type { PluginClientContext } from "@getpaseo/plugin/client";
import { ApproverSettings } from "./client/settings";

export default function contribute(client: PluginClientContext) {
  const remove = client.addSettingsScreen({ id: "approver", title: "Jev Approver", icon: "ShieldCheck", Component: ApproverSettings });
  return () => { remove?.(); };
}
