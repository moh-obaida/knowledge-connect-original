import { Toaster } from "@/components/ui/sonner";
import { Route, Switch } from "wouter";
import HostView from "./pages/HostView";
import JoinPage from "./pages/JoinPage";
import ParticipantView from "./pages/ParticipantView";
import Home from "./pages/Home";
import DisplayMode from "./pages/DisplayMode";
import { useLanguage } from "./hooks/useLanguage";

function App() {
  const { t } = useLanguage();
  return (
    <>
      <Toaster position="top-center" richColors />
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/host" component={HostView} />
        <Route path="/join" component={JoinPage} />
        <Route path="/participant" component={ParticipantView} />
        <Route path="/display" component={DisplayMode} />
        <Route>
          <div className="min-h-screen flex items-center justify-center text-center p-8">
            <div>
              <div className="text-6xl mb-4">٤٠٤</div>
              <div className="text-xl text-[#64748b]">{t("app.notFound")}</div>
            </div>
          </div>
        </Route>
      </Switch>
    </>
  );
}

export default App;
