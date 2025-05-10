import "./index.css";
import { APITester } from "./APITester";
import { Link, Route, Switch } from "wouter";
import Codenames from "./codenames";

export function App() {
  return (
    <div className="min-h-screen min-w-full mx-auto text-center relative z-10">
      <Switch>
        <Route path="/codenames">
          <Codenames />
        </Route>
        <Route path="/">
          <h1 className="text-5xl font-bold my-4 leading-tight">Bun + React</h1>
          <p>
            Edit{" "}
            <code className="bg-[#1a1a1a] px-2 py-1 rounded font-mono">
              client/App.tsx
            </code>{" "}
            and save to test HMR
          </p>
          <APITester />
        </Route>
      </Switch>
    </div>
  );
}

export default App;
