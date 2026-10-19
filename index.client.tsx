import { createElement } from "react";
import type { PluginClientContext } from "@getpaseo/plugin/client";
import { ApproverSettings } from "./client/settings";
import { ReviewHistory } from "./client/review-history";
import { registerJevPills } from "./client/jev-pill";

export default function contribute(client: PluginClientContext) {
  const Settings = () => createElement(ApproverSettings, {
    onOpenHistory: () => client.openScreen({ screenId: "reviews" }),
  });
  const settings = client.addSettingsScreen({ id: "approver", title: "Jev Approver", icon: "ShieldCheck", Component: Settings });
  const history = client.addScreen({ id: "reviews", title: "Review history", Component: ReviewHistory });
  const pills = registerJevPills(client);
  return () => { pills(); history(); settings(); };
}
