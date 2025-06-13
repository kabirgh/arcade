import { useEffect, useState } from "react";
import { ReadyState } from "react-use-websocket";

import { Channel, MessageType } from "../../../shared/types/domain/websocket";
import { useWebSocketContext } from "../contexts/WebSocketContext";

// Custom password prompt component
const PasswordPrompt = ({
  onSubmit,
  onCancel,
}: {
  onSubmit: (password: string) => void;
  onCancel: () => void;
}) => {
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(password);
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-84">
        <h2 className="text-lg text-left font-bold mb-4">Enter password</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-sky-200"
              autoFocus
              required
              data-1p-ignore="true"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onCancel}
              className="px-2 py-1 text-gray-600 bg-gray-200 rounded hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-2 py-1 text-white bg-blue-600 rounded hover:bg-blue-700"
            >
              Submit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const useAdminAuth = ({
  claimHost = false,
}: { claimHost?: boolean } = {}) => {
  const { publish, readyState } = useWebSocketContext();
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    // Skip authentication in development mode
    if (process.env.NODE_ENV === "development") {
      console.log("Skipping authentication in development mode");
      return true;
    }
    return sessionStorage.getItem("isAdminAuthenticated") === "true";
  });

  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);

  useEffect(() => {
    // Check if already authenticated in this session
    if (isAuthenticated) {
      if (claimHost && readyState === ReadyState.OPEN) {
        publish({
          channel: Channel.ADMIN,
          messageType: MessageType.CLAIM_HOST,
        });
      }
      return; // Don't prompt if already authenticated
    }

    // Show the password prompt
    setShowPasswordPrompt(true);
  }, [claimHost, isAuthenticated, publish, readyState]);

  const handlePasswordSubmit = (password: string) => {
    setShowPasswordPrompt(false);
    if (password === "bonk123") {
      setIsAuthenticated(true);
      sessionStorage.setItem("isAdminAuthenticated", "true");
      if (claimHost && readyState === ReadyState.OPEN) {
        publish({
          channel: Channel.ADMIN,
          messageType: MessageType.CLAIM_HOST,
        });
      }
    } else {
      alert("Incorrect password!");
    }
  };

  const handlePasswordCancel = () => {
    setShowPasswordPrompt(false);
  };

  return {
    isAuthenticated,
    passwordPrompt: showPasswordPrompt ? (
      <PasswordPrompt
        onSubmit={handlePasswordSubmit}
        onCancel={handlePasswordCancel}
      />
    ) : null,
  };
};
