import "./index.css";
import { Route, Switch } from "wouter";
import Codenames from "./codenames";
import Home from "./home";
import Join from "./join";
import Buzzer from "./buzzer";
import BuzzerHost from "./buzzer-host";
import { WebSocketProvider } from "./contexts/WebSocketContext";
import { PlayerProvider } from "./contexts/PlayerContext";
import Admin from "./admin";

export function App() {
  return (
    <WebSocketProvider>
      <PlayerProvider>
        <div className="min-h-screen min-w-full mx-auto text-center relative z-10">
          <Switch>
            {/* Player screens */}
            <Route path="/join">
              <Join />
            </Route>
            <Route path="/buzzer">
              <Buzzer />
            </Route>
            {/* Host screens */}
            <Route path="/">
              <Home />
            </Route>
            <Route path="/buzzer-host">
              <BuzzerHost />
            </Route>
            <Route path="/codenames">
              <Codenames />
            </Route>
            <Route path="/admin">
              <Admin />
            </Route>
            <Route>404 Not Found</Route>
          </Switch>
        </div>
      </PlayerProvider>
    </WebSocketProvider>
  );
}

export default App;
