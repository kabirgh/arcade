import { useEffect } from "react";
import { useLocation } from "wouter";

import { Channel, MessageType } from "../../../shared/types/domain/websocket";
import { useWebSocketContext } from "../contexts/WebSocketContext";

export const useListenNavigate = (pageType: "host" | "player") => {
  const { subscribe, unsubscribe } = useWebSocketContext();
  const [, setLocation] = useLocation();

  useEffect(() => {
    subscribe(Channel.ADMIN, (message) => {
      if (
        message.messageType === MessageType.HOST_NAVIGATE &&
        pageType === "host"
      ) {
        setLocation(message.payload.url);
      } else if (
        message.messageType === MessageType.PLAYER_NAVIGATE &&
        pageType === "player"
      ) {
        setLocation(message.payload.url);
      }
    });

    return () => {
      unsubscribe(Channel.ADMIN);
    };
  }, [subscribe, unsubscribe, setLocation, pageType]);
};
