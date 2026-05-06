import { Toaster } from "@/components/ui/sonner";
import { Route, Switch } from "wouter";
import HomePage from "./pages/HomePage";
import TemplatesPage from "./pages/TemplatesPage";
import PlayPage from "./pages/PlayPage";
import BuilderPage from "./pages/BuilderPage";

function App() {
  return (
    <>
      <Toaster position="top-center" richColors />
      <Switch>
        <Route path="/" component={HomePage} />
        <Route path="/templates" component={TemplatesPage} />
        <Route path="/play/:templateId" component={PlayPage} />
        <Route path="/create" component={BuilderPage} />
        <Route>
          <div className="min-h-screen flex items-center justify-center text-center p-8">
            <div>
              <div className="text-6xl mb-4">404</div>
              <div className="text-xl text-slate-500">Page not found</div>
            </div>
          </div>
        </Route>
      </Switch>
    </>
  );
}

export default App;
