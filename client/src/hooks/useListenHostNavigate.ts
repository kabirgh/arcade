import { useEffect } from "react";
import { useLocation } from "wouter";

import { Channel, MessageType } from "../../../shared/types/domain/websocket";
import { useWebSocketContext } from "../contexts/WebSocketContext";

export const useListenHostNavigate = () => {
  const { subscribe } = useWebSocketContext();
  const [, setLocation] = useLocation();

  useEffect(() => {
    const unsubscribeAdmin = subscribe(Channel.ADMIN, (message) => {
      if (message.messageType === MessageType.HOST_NAVIGATE) {
        setLocation(message.payload.screen);
      }
    });

    return unsubscribeAdmin;
  }, [setLocation, subscribe]);
};
