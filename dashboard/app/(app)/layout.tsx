import { ConfigProvider } from "@/components/ConfigProvider";
import { PrefsProvider } from "@/components/Prefs";
import { SaveBar } from "@/components/SaveBar";
import { Shell } from "@/components/Shell";
import { passwordConfigured } from "@/lib/auth";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <PrefsProvider>
      <ConfigProvider>
        <Shell protectedByPassword={passwordConfigured}>{children}</Shell>
        <SaveBar />
      </ConfigProvider>
    </PrefsProvider>
  );
}
