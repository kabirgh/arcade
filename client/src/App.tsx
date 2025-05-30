import "./index.css";

import { Route, Switch } from "wouter";

import { HostScreen, PlayerScreen } from "../../shared/types/domain/misc";
import Admin from "./admin";
import Boat from "./boat";
import Buzzer from "./buzzer";
import BuzzerHost from "./buzzer-host";
import Codenames from "./codenames";
import { PlayerProvider } from "./contexts/PlayerContext";
import { WebSocketProvider } from "./contexts/WebSocketContext";
import Join from "./join";
import Joystick from "./joystick";
import Lobby from "./lobby";
import Ninja from "./ninja";
import Pong from "./pong";

export function App() {
  return (
    <WebSocketProvider>
      <PlayerProvider>
        <div className="min-h-screen min-w-full mx-auto text-center relative z-10">
          <Switch>
            {/* Player screens */}
            <Route path={PlayerScreen.Join}>
              <Join />
            </Route>
            <Route path={PlayerScreen.Buzzer}>
              <Buzzer />
            </Route>
            <Route path={PlayerScreen.Joystick}>
              <Joystick />
            </Route>
            {/* Host screens */}
            <Route path={HostScreen.Lobby}>
              <Lobby />
            </Route>
            <Route path={HostScreen.BuzzerHost}>
              <BuzzerHost />
            </Route>
            <Route path={HostScreen.Codenames}>
              <Codenames />
            </Route>
            <Route path={HostScreen.Pong}>
              <Pong />
            </Route>
            <Route path={HostScreen.Boat}>
              <Boat />
            </Route>
            <Route path={HostScreen.Ninja}>
              <Ninja />
            </Route>
            <Route path="/admin">
              <Admin />
            </Route>
            <Route>
              <div className="mt-8 text-2xl font-bold">404 Not Found</div>
            </Route>
          </Switch>
        </div>
      </PlayerProvider>
    </WebSocketProvider>
  );
}

export default App;
