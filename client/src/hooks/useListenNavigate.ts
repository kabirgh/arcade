import { useEffect } from "react";
import { useLocation } from "wouter";

import { PlayerScreen } from "../../../shared/types/domain/misc";
import { Channel, MessageType } from "../../../shared/types/domain/websocket";
import { useWebSocketContext } from "../contexts/WebSocketContext";

export const useListenNavigate = (pageType: "host" | "player") => {
  const { subscribe } = useWebSocketContext();
  const [, setLocation] = useLocation();

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

    // For player pages, also listen for KICK messages to redirect to join screen
    const unsubscribePlayer =
      pageType === "player"
        ? subscribe(Channel.PLAYER, (message) => {
            if (message.messageType === MessageType.KICK) {
              setLocation(PlayerScreen.Join);
            }
          })
        : () => {};

    return () => {
      unsubscribeAdmin();
      unsubscribePlayer();
    };
  }, [pageType, setLocation, subscribe]);
};
