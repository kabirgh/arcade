import { shuffle } from "../../shared/utils";
import { useEffect, useState, useRef } from "react";
import { Card, CardType, GameState, Team } from "../../shared/types/codenames";

const UNSELECTED_CARD_STYLES = {
  [CardType.Red]: "bg-white text-black box-border border-6 border-[#D13030]",
  [CardType.Blue]: "bg-white text-black box-border border-6 border-[#4183CC]",
  [CardType.Neutral]:
    "bg-white text-black box-border border-6 border-[#F8E4C8]",
  [CardType.Assassin]:
    "bg-white text-black box-border border-6 border-gray-900",
};

const SELECTED_CARD_STYLES = {
  [CardType.Red]: "bg-[#D13030] text-white",
  [CardType.Blue]: "bg-[#4183CC] text-white",
  [CardType.Neutral]: "bg-[#F8E4C8] text-black",
  [CardType.Assassin]: "bg-gray-900 text-white",
};

const SHUFFLED_TYPES: CardType[] = shuffle([
  ...Array(9).fill(CardType.Red),
  ...Array(8).fill(CardType.Blue),
  ...Array(7).fill(CardType.Neutral),
  CardType.Assassin,
]);

type TeamWordsListProps = {
  teamName: string;
  teamColor: string;
  cards: Card[];
  cardType: CardType;
};

const TeamWordsList: React.FC<TeamWordsListProps> = ({
  teamName,
  teamColor,
  cards,
  cardType,
}) => {
  return (
    <div
      className="p-4 rounded-md text-white w-[200px] h-[300px]"
      style={{ backgroundColor: teamColor }}
    >
      <h3 className="text-lg font-bold mb-2 text-left">{teamName}</h3>
      <ul className="list-none">
        {cards
          .filter((card) => card.type === cardType)
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

export const Codenames = () => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clueWord, setClueWord] = useState("");
  const [clueNumber, setClueNumber] = useState<number>(1);
  const clueInputRef = useRef<HTMLInputElement>(null);

  // Fetch game state from server
  const fetchGameState = async () => {
    try {
      const response = await fetch("/api/codenames/state");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setGameState(data.state);
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
      const response = await fetch("/api/codenames/start");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setGameState(data.state);
    } catch (error) {
      console.error("Failed to start game:", error);
      setError("Failed to start game");
    } finally {
      setLoading(false);
    }
  };

  // Submit a clue
  const submitClue = async () => {
    if (!clueWord.trim()) {
      setError("Please enter a clue word");
      return;
    }

    try {
      const response = await fetch("/api/codenames/clue", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clueWord: clueWord.trim(),
          clueNumber: clueNumber,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to submit clue");
      }

      const data = await response.json();
      setGameState(data.state);

      setClueWord("");
      if (clueInputRef.current) {
        clueInputRef.current.value = "";
      }
    } catch (error: any) {
      console.error("Failed to submit clue:", error);
      setError(error.message || "Failed to submit clue");
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
      gameState.remainingGuesses <= 0
    ) {
      return;
    }

    try {
      const response = await fetch("/api/codenames/guess", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          word,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to make guess");
      }

      setGameState(data.state);
    } catch (error: any) {
      console.error("Failed to make guess:", error);
      setError(error.message || "Failed to make guess");
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
        gridTemplateColumns: "2fr 6fr 2fr",
        gridTemplateRows: "1.2fr 7fr 1.8fr",
        gridTemplateAreas: `
          "header header header"
          "left center right"
          "footer footer footer"
        `,
      }}
    >
      <div
        className="flex flex-col items-center space-y-4 justify-self-center"
        style={{
          gridArea: "left",
        }}
      >
        <TeamWordsList
          teamName="Red team"
          teamColor="#D13030"
          cards={gameState.board}
          cardType={CardType.Red}
        />
      </div>

      <div
        className="grid grid-cols-5 gap-2 justify-self-center"
        style={{
          gridArea: "center",
        }}
      >
        {gameState.board.map((card, index) => {
          const style = card.isRevealed
            ? SELECTED_CARD_STYLES[card.type]
            : UNSELECTED_CARD_STYLES[card.type];
          return (
            <div
              key={index}
              className={`p-4 h-22 w-34 rounded-sm flex items-center justify-center text-center font-bold ${style}`}
              style={{
                cursor: gameState.phase === "CLUE" ? "default" : "pointer",
              }}
              onClick={() => handleCardClick(card.word)}
            >
              {card.word}
            </div>
          );
        })}
      </div>

      <div
        className="flex flex-col items-center space-y-4 justify-self-center"
        style={{
          gridArea: "right",
        }}
      >
        <TeamWordsList
          teamName="Blue team"
          teamColor="#4183CC"
          cards={gameState.board}
          cardType={CardType.Blue}
        />
      </div>

      <div
        className="justify-self-center"
        style={{
          gridArea: "header",
        }}
      >
        <div className="flex flex-col items-center font-bold">
          <div
            style={{
              color: gameState.turn === "red" ? "#D13030" : "#4183CC",
            }}
          >
            {gameState.turn.toUpperCase()}
          </div>
          <div>{gameState.phase === "CLUE" ? "Give clue" : "Guess"}</div>
          {gameState.clue && (
            <div className="font-bold">
              Current clue: {gameState.clue.word} ({gameState.clue.number})
              {gameState.phase === "GUESS" && (
                <span className="ml-2">
                  Remaining guesses: {gameState.remainingGuesses}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div
        className="justify-self-center w-full flex justify-center"
        style={{
          gridArea: "footer",
        }}
      >
        <div className="text-md flex items-center h-[40px]">
          {gameState.phase === "CLUE" && (
            <div>
              <input
                id="clue-input"
                ref={clueInputRef}
                type="text"
                placeholder="Clue"
                className="h-full mx-2 px-2 border-1 border-black bg-white py-1"
                onChange={(e) => setClueWord(e.target.value)}
              />
              <input
                type="number"
                min="0"
                max="9"
                value={clueNumber}
                onChange={(e) => setClueNumber(parseInt(e.target.value))}
                className="h-full w-12 mx-2 px-2 border-1 border-black bg-white py-1"
              />
              <button
                className="h-full text-white bg-green-700 hover:bg-green-800 cursor-pointer px-3 py-1.5 rounded-sm"
                onClick={submitClue}
              >
                Submit
              </button>
            </div>
          )}
          {gameState.phase === "GUESS" && (
            <button
              className="h-full text-white bg-blue-700 hover:bg-blue-800 cursor-pointer px-3 py-1.5 rounded-sm"
              onClick={() => {
                fetch("/api/codenames/end-turn", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                })
                  .then((response) => response.json())
                  .then((data) => {
                    if (data.state) {
                      setGameState(data.state);
                    }
                  })
                  .catch((error) => {
                    console.error("Failed to end turn:", error);
                    setError("Failed to end turn");
                  });
              }}
            >
              End Turn
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
export default Codenames;
