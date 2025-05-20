import OpenAI from "openai";

import {
  type CodenamesAskLlmResponse,
  type CodenamesClueRequest,
  type CodenamesClueResponse,
  type CodenamesEndTurnResponse,
  type CodenamesGuessRequest,
  type CodenamesGuessResponse,
  type CodenamesStartResponse,
  type CodenamesStateResponse,
} from "../shared/types/api/codenames";
import { type ResponseEnvelope } from "../shared/types/api/common";
import {
  type Card,
  CardClass,
  type CodenamesTeam,
  type GameState,
} from "../shared/types/domain/codenames";
import { shuffle } from "../shared/utils";

const client = new OpenAI({ apiKey: process.env["OPENAI_API_KEY"] });

const words = await Bun.file("./server/words.txt").text();

const makePrompt = (gameState: GameState) => {
  const { board, history, remainingGuesses, clue, turn } = gameState;

  const boardForGuessing = board.map((c) => ({
    word: c.word,
    color: c.isRevealed ? c.class : "unknown",
  }));

  const previousGuessesThisRound = [];
  for (const h of history.reverse()) {
    if (h.phase === "GUESS" && h.team === turn) {
      previousGuessesThisRound.push(h.message);
    } else {
      break;
    }
  }

  return `
  You are guessing the words in a codenames game. You are on the ${turn} team.

  This is the current board state:
  <board>
  ${JSON.stringify(boardForGuessing)}
  </board>

  This is the history of the game so far. Look at the history to see the clues and guesses.
  <history>
  ${JSON.stringify(history)}
  </history>

  Your clue is: "${clue!.word} ${clue!.number}".
  ${
    previousGuessesThisRound.length > 0
      ? `In this round, you have already guessed: ${previousGuessesThisRound.join(
          ", "
        )}.`
      : ""
  }

  STRATEGY NOTE:
  Bear in mind that the number of guesses in a round is 1 more than the clue number. Often the clue-giver expects you to use the number in the clue for this round, and use the "extra" guess to catch up on a clue for which you guessed incorrectly or passed on previously. You should examine the history to judge when it is wise to use the extra guess.

  Output instructions:
  - List the word you want to guess on a new line. You can only guess one word per turn.
  - You can only guess words where the color is "unknown".
  - Output only the word. Do not include any other commentary, explanations, or conversational text.
  - For example, if you want to guess "APPLE" your response should be:
  APPLE
  - To pass your turn, respond with the word PASS on a new line.
  - Recall the strategy note above before making your guess.
  `;
};

class CodenamesGame {
  private gameState: GameState = {
    board: [],
    turn: "red",
    phase: "CLUE",
    clue: null,
    remainingGuesses: 0,
    score: { red: 0, blue: 0 },
    history: [],
  };

  constructor() {
    this.startGame();
  }

  public getGameState(): GameState {
    return this.gameState;
  }

  public async *askLlm(): AsyncGenerator<CodenamesAskLlmResponse> {
    console.log("prompt", makePrompt(this.gameState));

    const stream = await client.responses.create({
      model: "o4-mini-2025-04-16",
      reasoning: { effort: "low", summary: "auto" },
      input: makePrompt(this.gameState),
      stream: true,
    });

    for await (const event of stream) {
      if (event.type === "response.reasoning_summary_text.delta") {
        yield { thinking: event.delta, output: "" };
      }
      if (event.type === "response.output_text.done") {
        console.log("completed", event.text);
        yield { thinking: "", output: event.text };
      }
    }
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
      history: [],
    };
  }

  public async submitClue(
    clueWord: string,
    clueNum: number
  ): Promise<GameState> {
    if (this.gameState.phase !== "CLUE") {
      throw new Error("Not your turn");
    }

    this.gameState.clue = { word: clueWord, number: clueNum };
    this.gameState.phase = "GUESS";
    this.gameState.remainingGuesses = clueNum + 1;

    this.gameState.history.push({
      team: this.gameState.turn,
      phase: "CLUE",
      message: `${clueWord} ${clueNum}`,
    });

    // this.gameState.guess = await this.askLlm();

    return this.gameState;
  }

  public async submitGuess(word: string): Promise<GameState> {
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

    // Add to history
    this.gameState.history.push({
      team: this.gameState.turn,
      phase: "GUESS",
      message: word,
    });

    // Handle the result based on card type
    if (card.class === CardClass.Assassin) {
      // Game over - the other team wins
      const winner: CodenamesTeam =
        this.gameState.turn === "red" ? "blue" : "red";
      this.gameState.score[winner]++;
      this.gameState.phase = "GAME_OVER";
    } else if (
      (card.class === CardClass.Red && this.gameState.turn === "red") ||
      (card.class === CardClass.Blue && this.gameState.turn === "blue")
    ) {
      // Correct guess
      this.gameState.remainingGuesses -= 1;

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
        this.gameState.score[this.gameState.turn]++;
        this.gameState.remainingGuesses = 0;
        this.gameState.phase = "GAME_OVER";
        return this.gameState;
      }
    } else if (
      (card.class === CardClass.Red && this.gameState.turn === "blue") ||
      (card.class === CardClass.Blue && this.gameState.turn === "red")
    ) {
      // Incorrect guess - opponent's card
      this.gameState.remainingGuesses = 0;

      const opponent: CodenamesTeam =
        this.gameState.turn === "red" ? "blue" : "red";

      // Check if all cards of the opponent's color are revealed
      const allOpponentCardsRevealed = this.gameState.board
        .filter(
          (c) =>
            c.class === (opponent === "red" ? CardClass.Red : CardClass.Blue)
        )
        .every((c) => c.isRevealed);

      if (allOpponentCardsRevealed) {
        // Game over - opponent wins
        this.gameState.score[opponent]++;
      }
    } else {
      // Neutral card
      this.gameState.remainingGuesses = 0;
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

export const handleCodenamesState =
  (): ResponseEnvelope<CodenamesStateResponse> => {
    return {
      ok: true,
      data: {
        state: codenamesGame.getGameState(),
      },
    };
  };

export const handleCodenamesStart =
  (): ResponseEnvelope<CodenamesStartResponse> => {
    codenamesGame.startGame();
    return {
      ok: true,
      data: {
        state: codenamesGame.getGameState(),
      },
    };
  };

export const handleCodenamesClue = async (
  req: CodenamesClueRequest
): Promise<ResponseEnvelope<CodenamesClueResponse>> => {
  try {
    const state = await codenamesGame.submitClue(req.clueWord, req.clueNumber);
    return {
      ok: true,
      data: {
        state,
      },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    return {
      ok: false,
      error: {
        status: 500,
        message: error.message,
      },
    };
  }
};

export async function* handleCodenamesAskLlm(): AsyncGenerator<CodenamesAskLlmResponse> {
  for await (const event of codenamesGame.askLlm()) {
    yield event;
  }
}

export const handleCodenamesGuess = async (
  req: CodenamesGuessRequest
): Promise<ResponseEnvelope<CodenamesGuessResponse>> => {
  try {
    const state = await codenamesGame.submitGuess(req.word);
    return {
      ok: true,
      data: {
        state,
      },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    return {
      ok: false,
      error: {
        status: 500,
        message: error.message,
      },
    };
  }
};

export const handleCodenamesEndTurn =
  (): ResponseEnvelope<CodenamesEndTurnResponse> => {
    try {
      const state = codenamesGame.endTurn();
      return {
        ok: true,
        data: {
          state,
        },
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      return {
        ok: false,
        error: {
          status: 500,
          message: error.message,
        },
      };
    }
  };
