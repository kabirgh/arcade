import { Elysia, t } from "elysia";
import {
  CardClass,
  CardType,
  type Card,
  type CodenamesClueRequest,
  type CodenamesClueResponse,
  type CodenamesGuessRequest,
  type CodenamesGuessResponse,
  type CodenamesStartResponse,
  type CodenamesStateResponse,
  type GameState,
  type Team,
} from "../shared/types/codenames";
import { shuffle } from "../shared/utils";
import { APIRoute } from "../shared/types/routes";

const words = await Bun.file("./server/words.txt").text();

class CodenamesGame {
  private gameState: GameState = {
    board: [],
    turn: "red",
    phase: "CLUE",
    clue: null,
    remainingGuesses: 0,
    score: { red: 0, blue: 0 },
    chat: { red: [], blue: [] },
  };

  constructor() {
    this.startGame();
  }

  public getGameState(): GameState {
    return this.gameState;
  }

  public startGame(): void {
    const allWords: string[] = words.split(/\n/).filter(Boolean);
    const shuffledWords = shuffle(allWords);
    const gameWords = shuffledWords.slice(0, 25);

    // Create a board with the cards
    const board: Card[] = gameWords.map((word) => ({
      word,
      class: CardClass.Neutral,
      isRevealed: false,
    }));

    // Distribute card types
    const cardIndices = shuffle([...Array(25).keys()]);

    // Assign 9 red cards (first team gets 9, second gets 8)
    for (let i = 0; i < 9; i++) {
      board[cardIndices[i]].class = CardClass.Red;
    }

    // Assign 8 blue cards
    for (let i = 9; i < 17; i++) {
      board[cardIndices[i]].class = CardClass.Blue;
    }

    // Assign 1 assassin card
    board[cardIndices[17]].class = CardClass.Assassin;
    // The rest remain neutral

    this.gameState = {
      board,
      turn: "red",
      phase: "CLUE",
      clue: null,
      remainingGuesses: 0,
      score: { red: 0, blue: 0 },
      chat: { red: [], blue: [] },
    };
  }

  public submitClue(clueWord: string, clueNum: number): GameState {
    if (this.gameState.phase !== "CLUE") {
      throw new Error("Not your turn");
    }

    this.gameState.clue = { word: clueWord, number: clueNum };
    this.gameState.phase = "GUESS";
    this.gameState.remainingGuesses = clueNum + 1;

    this.gameState.chat[this.gameState.turn].push({
      role: "user",
      content: `CLUE "${clueWord}" ${clueNum}`,
    });

    return this.gameState;
  }

  public submitGuess(word: string): GameState {
    // Validate it's the team's turn and in guess phase
    if (this.gameState.phase !== "GUESS") {
      throw new Error("Not your turn");
    }

    // Find the card
    const cardIndex = this.gameState.board.findIndex(
      (card) => card.word === word
    );
    if (cardIndex === -1) {
      throw new Error("Card not found");
    }

    const card = this.gameState.board[cardIndex];

    // Card already revealed
    if (card.isRevealed) {
      throw new Error("Card already revealed");
    }

    // Reveal the card
    card.isRevealed = true;

    // Add to chat
    this.gameState.chat[this.gameState.turn].push({
      role: "user",
      content: `GUESS "${word}"`,
    });

    // Handle the result based on card type
    if (card.class === CardClass.Assassin) {
      // Game over - the other team wins
      const winner: Team = this.gameState.turn === "red" ? "blue" : "red";
      this.gameState.chat[this.gameState.turn].push({
        role: "system",
        content: `You picked the assassin! ${winner.toUpperCase()} team wins!`,
      });
      this.gameState.score[winner]++;
    } else if (
      (card.class === CardClass.Red && this.gameState.turn === "red") ||
      (card.class === CardClass.Blue && this.gameState.turn === "blue")
    ) {
      // Correct guess
      this.gameState.remainingGuesses -= 1;

      this.gameState.chat[this.gameState.turn].push({
        role: "system",
        content: `Correct! That's a ${this.gameState.turn} card.`,
      });

      // Check if all cards of the team's color are revealed
      const allTeamCardsRevealed = this.gameState.board
        .filter(
          (c) =>
            c.class ===
            (this.gameState.turn === "red" ? CardClass.Red : CardClass.Blue)
        )
        .every((c) => c.isRevealed);

      if (allTeamCardsRevealed) {
        // Game over - this team wins
        this.gameState.chat[this.gameState.turn].push({
          role: "system",
          content: `${this.gameState.turn.toUpperCase()} team has found all their cards and wins!`,
        });
        this.gameState.score[this.gameState.turn]++;
        return this.gameState;
      }
    } else if (
      (card.class === CardClass.Red && this.gameState.turn === "blue") ||
      (card.class === CardClass.Blue && this.gameState.turn === "red")
    ) {
      // Incorrect guess - opponent's card
      this.gameState.remainingGuesses = 0;

      const opponent: Team = this.gameState.turn === "red" ? "blue" : "red";
      this.gameState.chat[this.gameState.turn].push({
        role: "system",
        content: `Oops! That's a ${opponent} card.`,
      });

      // Check if all cards of the opponent's color are revealed
      const allOpponentCardsRevealed = this.gameState.board
        .filter(
          (c) =>
            c.class === (opponent === "red" ? CardClass.Red : CardClass.Blue)
        )
        .every((c) => c.isRevealed);

      if (allOpponentCardsRevealed) {
        // Game over - opponent wins
        this.gameState.chat[this.gameState.turn].push({
          role: "system",
          content: `${opponent.toUpperCase()} team has found all their cards and wins!`,
        });
        this.gameState.score[opponent]++;
      }
    } else {
      // Neutral card
      this.gameState.remainingGuesses = 0;

      this.gameState.chat[this.gameState.turn].push({
        role: "system",
        content: `That's a neutral card. Turn ends.`,
      });
    }

    if (this.gameState.remainingGuesses === 0) {
      this.endTurn();
    }

    return this.gameState;
  }

  public endTurn(): GameState {
    this.gameState.turn = this.gameState.turn === "red" ? "blue" : "red";
    this.gameState.phase = "CLUE";
    this.gameState.clue = null;
    return this.gameState;
  }
}

// Create and export a singleton instance
export const codenamesGame = new CodenamesGame();

export const handleCodenamesState = (): CodenamesStateResponse => {
  return {
    state: codenamesGame.getGameState(),
  };
};

export const handleCodenamesStart = (): CodenamesStartResponse => {
  codenamesGame.startGame();
  return {
    state: codenamesGame.getGameState(),
  };
};

export const handleCodenamesClue = (
  req: CodenamesClueRequest
): CodenamesClueResponse => {
  try {
    const state = codenamesGame.submitClue(req.clueWord, req.clueNumber);
    return {
      state,
    };
  } catch (error: any) {
    return {
      state: codenamesGame.getGameState(),
      error: error.message,
    };
  }
};

export const handleCodenamesGuess = (
  req: CodenamesGuessRequest
): CodenamesGuessResponse => {
  try {
    const state = codenamesGame.submitGuess(req.word);
    return {
      state,
    };
  } catch (error: any) {
    return {
      error: error.message,
      state: codenamesGame.getGameState(),
    };
  }
};

export const handleCodenamesEndTurn = (): CodenamesGuessResponse => {
  try {
    const state = codenamesGame.endTurn();
    return {
      state,
    };
  } catch (error: any) {
    return {
      error: error.message,
    };
  }
};
