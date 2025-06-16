import { useEffect, useRef, useState } from "react";

import { APIRoute } from "../../shared/types/api/schema";
import {
  type Card,
  CardClass,
  type GameState,
} from "../../shared/types/domain/codenames";
import { Markdown } from "./components/Markdown";
import { useAdminAuth } from "./hooks/useAdminAuth";
import { useListenHostNavigate } from "./hooks/useListenHostNavigate";
import { apiFetch } from "./util/apiFetch";

const UNSELECTED_CARD_STYLES = {
  [CardClass.Red]: "bg-white text-black box-border border-6 border-[#D13030]",
  [CardClass.Blue]: "bg-white text-black box-border border-6 border-[#4183CC]",
  [CardClass.Neutral]:
    "bg-white text-black box-border border-6 border-[#F8E4C8]",
  [CardClass.Assassin]:
    "bg-white text-black box-border border-6 border-gray-900",
};

const SELECTED_CARD_STYLES = {
  [CardClass.Red]: "bg-[#D13030] text-white",
  [CardClass.Blue]: "bg-[#4183CC] text-white",
  [CardClass.Neutral]: "bg-[#F8E4C8] text-black",
  [CardClass.Assassin]: "bg-gray-900 text-white",
};

type TeamWordsListProps = {
  teamColor: string;
  cards: Card[];
  cardClass: CardClass;
};

const TeamWordsList: React.FC<TeamWordsListProps> = ({
  teamColor,
  cards,
  cardClass,
}) => {
  return (
    <div
      className="p-4 rounded-md text-white w-[200px] h-[250px]"
      style={{ backgroundColor: teamColor }}
    >
      <ul className="list-none">
        {cards
          .filter((card) => card.class === cardClass)
          .map((card, index) => (
            <li
              key={index}
              className="text-md text-left"
              style={{
                textDecorationLine: card.isRevealed ? "line-through" : "none",
                textDecorationThickness: "2px",
              }}
            >
              {card.word}
            </li>
          ))}
      </ul>
    </div>
  );
};

// TODO: game over screen
export const Codenames = () => {
  useListenHostNavigate();
  // TODO: use value of isAuthenticated?
  const { passwordPrompt } = useAdminAuth({ claimHost: true });
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clueWord, setClueWord] = useState("");
  const [clueNumber, setClueNumber] = useState<number>(1);
  const [actionInProgress, setActionInProgress] = useState(false);
  const clueInputRef = useRef<HTMLInputElement>(null);
  const [llmThinking, setLlmThinking] = useState("");
  const [llmOutput, setLlmOutput] = useState("");

  // Fetch game state from server
  const fetchGameState = async () => {
    try {
      const response = await apiFetch(APIRoute.CodenamesState);
      setGameState(response.state);
    } catch (error) {
      console.error("Failed to fetch game state:", error);
      setError("Failed to fetch game state");
    } finally {
      setLoading(false);
    }
  };

  // Start a new game
  const startGame = async () => {
    try {
      setLoading(true);
      const response = await apiFetch(APIRoute.CodenamesStart, {});
      setGameState(response.state);
    } catch (error) {
      console.error("Failed to start game:", error);
      setError("Failed to start game");
    } finally {
      setLoading(false);
    }
  };

  // Ask LLM to guess
  const askLlm = async () => {
    const llmResponse = await fetch("/api/codenames/ask-llm");
    const reader = llmResponse.body?.getReader();
    if (!reader) {
      throw new Error("Failed to get stream reader");
    }

    setLlmThinking("");
    setLlmOutput("");

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      // Convert the Uint8Array to text
      const text = new TextDecoder().decode(value);
      console.log(text);

      // Process complete lines (JSON objects)
      const lines = text.split("\n");

      // Process complete lines
      for (const line of lines) {
        if (!line.trim()) continue; // Skip empty lines

        try {
          const json = JSON.parse(line);
          console.log(json);
          if (json.thinking) {
            setLlmThinking((prev) => prev + json.thinking);
          } else if (json.output) {
            setLlmOutput((prev) => prev + json.output);
          }
        } catch {
          console.error("Failed to parse JSON line:", line);
        }
      }
    }
  };

  // Submit a clue
  const submitClue = async () => {
    if (!clueWord.trim()) {
      setError("Please enter a clue word");
      return;
    }

    try {
      setActionInProgress(true);
      const data = await apiFetch(APIRoute.CodenamesClue, {
        clueWord: clueWord.trim(),
        clueNumber: clueNumber,
      });

      await askLlm();

      setGameState(data.state);
      setClueWord("");
      if (clueInputRef.current) {
        clueInputRef.current.value = "";
      }
    } catch (error: any) {
      console.error("Failed to submit clue:", error);
      setError(error.message || "Failed to submit clue");
    } finally {
      setActionInProgress(false);
    }
  };

  // Handle card click (make a guess)
  const handleCardClick = async (word: string) => {
    if (!gameState) return;

    // Only allow guessing in GUESS phase, if the card is not already revealed, and if there are remaining guesses
    const clickedCard = gameState.board.find((card) => card.word === word);
    if (
      !clickedCard ||
      clickedCard.isRevealed ||
      gameState.phase !== "GUESS" ||
      gameState.remainingGuesses <= 0 ||
      actionInProgress
    ) {
      return;
    }

    setActionInProgress(true);
    try {
      const data = await apiFetch(APIRoute.CodenamesGuess, { word });
      setGameState(data.state);

      // If there are remaining guesses, ask LLM to guess again
      if (gameState.phase === "GUESS" && gameState.remainingGuesses > 0) {
        await askLlm();
      }

      // TODO handle game over
    } catch (error: any) {
      console.error("Failed to make guess:", error);
      setError(error.message || "Failed to make guess");
    } finally {
      setActionInProgress(false);
    }
  };

  useEffect(() => {
    // Start game when component mounts
    startGame();
  }, []);

  if (loading) {
    return <div>Loading game...</div>;
  }

  if (error) {
    return (
      <div className="text-red-500 p-4">
        Error: {error}
        <button
          className="ml-4 bg-blue-500 text-white px-2 py-1 rounded"
          onClick={() => {
            setError(null);
            fetchGameState();
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!gameState) {
    return <div>No game state available</div>;
  }

  return (
    <div
      id="codenames-body"
      className="grid items-center min-h-screen min-w-full"
      style={{
        gridTemplateColumns: "2.5fr 6fr 2.5fr",
        gridTemplateRows: "1.5fr 7fr 1.5fr",
      }}
    >
      {passwordPrompt}
      <div className="flex flex-col items-center space-y-4 justify-self-center col-start-1 col-span-1 row-start-1 row-span-full">
        <TeamWordsList
          teamColor="#D13030"
          cards={gameState.board}
          cardClass={CardClass.Red}
        />
        <TeamWordsList
          teamColor="#4183CC"
          cards={gameState.board}
          cardClass={CardClass.Blue}
        />
      </div>

      <div className="grid grid-cols-5 gap-2 justify-self-center col-start-2 col-span-1 row-start-2 row-span-1">
        {gameState.board.map((card, index) => {
          const style = card.isRevealed
            ? SELECTED_CARD_STYLES[card.class]
            : UNSELECTED_CARD_STYLES[card.class];
          return (
            <div
              key={index}
              className={`p-4 h-22 w-34 rounded-sm flex items-center justify-center text-center font-bold ${style}`}
              style={{
                cursor:
                  gameState.phase === "CLUE" || actionInProgress
                    ? "default"
                    : "pointer",
              }}
              onClick={() => handleCardClick(card.word)}
            >
              {card.word}
            </div>
          );
        })}
      </div>

      <div className="flex flex-col justify-self-center col-start-3 col-span-1 row-start-1 row-span-3 mr-10">
        {llmThinking && (
          <div className="text-left text-sm p-4 bg-gray-100 rounded-md w-full max-h-[600px] overflow-y-auto">
            <Markdown>{llmThinking}</Markdown>
            <br />
            <div className="text-center text-lg font-bold">
              <Markdown>{llmOutput}</Markdown>
            </div>
          </div>
        )}
      </div>

      <div className="justify-self-center col-start-2 col-span-1 row-start-1 row-span-1">
        <div className="flex flex-col items-center font-bold">
          <div
            style={{
              color: gameState.turn === "red" ? "#D13030" : "#4183CC",
            }}
          >
            {gameState.turn.toUpperCase()}
            {" - "}
            {gameState.phase === "CLUE" ? "Give clue" : "Guess"}
          </div>
          {gameState.clue && (
            <div className="font-bold">
              Current clue: {gameState.clue.word} ({gameState.clue.number})
              <br />
              {gameState.phase === "GUESS" && (
                <span className="ml-2">
                  Remaining guesses: {gameState.remainingGuesses}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="justify-self-center col-start-2 col-span-1 row-start-3 row-span-1">
        <div className="text-md flex items-center">
          {gameState.phase === "CLUE" && (
            <div>
              <input
                id="clue-input"
                ref={clueInputRef}
                type="text"
                placeholder="Clue"
                className="h-full mx-2 px-2 border-1 border-black bg-white py-1"
                onChange={(e) => setClueWord(e.target.value)}
                disabled={actionInProgress}
              />
              <input
                type="number"
                min="0"
                max="9"
                value={clueNumber}
                onChange={(e) => setClueNumber(parseInt(e.target.value))}
                className="h-full w-12 mx-2 px-2 border-1 border-black bg-white py-1"
                disabled={actionInProgress}
              />
              <button
                className="h-full text-white bg-green-700 hover:bg-green-800 cursor-pointer px-3 py-1.5 rounded-sm"
                onClick={submitClue}
                disabled={actionInProgress}
              >
                {actionInProgress ? "Thinking..." : "Submit"}
              </button>
            </div>
          )}
          {gameState.phase === "GUESS" && (
            <div className="flex flex-col items-center">
              {gameState.clue && llmOutput !== "" && (
                <div className="mb-2 font-semibold">
                  {gameState.turn === "red" ? "Redzo" : "Bluey"}
                  {" guessed "}
                  {llmOutput}
                </div>
              )}
              <button
                className="h-full text-white bg-blue-700 hover:bg-blue-800 cursor-pointer px-3 py-1.5 rounded-sm"
                onClick={() => {
                  setActionInProgress(true);
                  apiFetch(APIRoute.CodenamesEndTurn, {})
                    .then((data) => {
                      setGameState(data.state);
                    })
                    .catch((error) => {
                      console.error("Failed to pass:", error);
                      setError("Failed to pass");
                    })
                    .finally(() => {
                      setActionInProgress(false);
                    });
                }}
                disabled={actionInProgress}
              >
                {actionInProgress ? "Thinking..." : "Pass"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default Codenames;
