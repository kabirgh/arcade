import { useEffect } from "react";
import { useLocation } from "wouter";

import { APIRoute } from "../../../shared/types/api/schema";
import { type Player } from "../../../shared/types/domain/player";
import { Channel, MessageType } from "../../../shared/types/domain/websocket";
import { useWebSocketContext } from "../contexts/WebSocketContext";
import { apiFetch } from "../util/apiFetch";

export const useListenPlayerNavigate = (sessionPlayer: Player | null) => {
  const { subscribe } = useWebSocketContext();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!sessionPlayer) return;

    apiFetch(APIRoute.PlayerScreen).then(({ screen }) => {
      setLocation(screen);
    });
  }, [setLocation, sessionPlayer]);

  useEffect(() => {
    const unsubscribeAdmin = subscribe(Channel.ADMIN, (message) => {
      if (message.messageType === MessageType.PLAYER_NAVIGATE) {
        setLocation(message.payload.screen);
      }
    });

    return unsubscribeAdmin;
  }, [setLocation, subscribe]);
};
