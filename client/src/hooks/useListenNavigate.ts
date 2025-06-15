import { useEffect } from "react";
import { useLocation } from "wouter";

import { APIRoute } from "../../../shared/types/api/schema";
import { Channel, MessageType } from "../../../shared/types/domain/websocket";
import { useWebSocketContext } from "../contexts/WebSocketContext";
import { apiFetch } from "../util/apiFetch";

export const useListenNavigate = (pageType: "host" | "player") => {
  const { subscribe } = useWebSocketContext();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (pageType === "host") return;

    apiFetch(APIRoute.PlayerScreen).then(({ screen }) => {
      setLocation(screen);
    });
  }, [pageType, setLocation]);

  useEffect(() => {
    const unsubscribeAdmin = subscribe(Channel.ADMIN, (message) => {
      if (
        message.messageType === MessageType.HOST_NAVIGATE &&
        pageType === "host"
      ) {
        setLocation(message.payload.screen);
      } else if (
        message.messageType === MessageType.PLAYER_NAVIGATE &&
        pageType === "player"
      ) {
        setLocation(message.payload.screen);
      }
    });

    return unsubscribeAdmin;
  }, [pageType, setLocation, subscribe]);
};
