import "./index.css";
import { Route, Switch } from "wouter";
import Codenames from "./codenames";
import Home from "./home";
import JoinScreen from "./join";

export function App() {
  return (
    <div className="min-h-screen min-w-full mx-auto text-center relative z-10">
      <Switch>
        <Route path="/codenames">
          <Codenames />
        </Route>
        <Route path="/join">
          <JoinScreen />
        </Route>
        <Route path="/">
          <Home />
        </Route>
      </Switch>
    </div>
  );
}

export default App;
