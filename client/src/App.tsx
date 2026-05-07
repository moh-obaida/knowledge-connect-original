import { Toaster } from "@/components/ui/sonner";
import { Route, Switch } from "wouter";
import HostView from "./pages/HostView";
import JoinPage from "./pages/JoinPage";
import ParticipantView from "./pages/ParticipantView";
import Home from "./pages/Home";

function App() {
  return (
    <>
      <Toaster position="top-center" richColors />
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/host" component={HostView} />
        <Route path="/join" component={JoinPage} />
        <Route path="/participant" component={ParticipantView} />
        <Route>
          <div className="min-h-screen flex items-center justify-center text-center p-8">
            <div>
              <div className="text-6xl mb-4">٤٠٤</div>
              <div className="text-xl text-[#64748b]">الصفحة غير موجودة</div>
            </div>
          </div>
        </Route>
      </Switch>
    </>
  );
}

export default App;
