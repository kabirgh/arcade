import "./index.css";
import { Route, Switch } from "wouter";
import Codenames from "./codenames";
import Home from "./home";
import JoinScreen from "./join";
import Buzzer from "./buzzer";
import { WebSocketProvider } from "./contexts/WebSocketContext";

export function App() {
  return (
    <WebSocketProvider>
      <div className="min-h-screen min-w-full mx-auto text-center relative z-10">
        <Switch>
          <Route path="/">
            <Home />
          </Route>
          <Route path="/join">
            <JoinScreen />
          </Route>
          <Route path="/codenames">
            <Codenames />
          </Route>
          <Route path="/buzzer">
            <Buzzer />
          </Route>
          <Route>404 Not Found</Route>
        </Switch>
      </div>
    </WebSocketProvider>
  );
}

export default App;
