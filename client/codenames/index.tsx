import { shuffle } from "../../shared/utils";
import { useEffect, useState } from "react";

enum CardType {
  Red,
  Blue,
  Neutral,
  Assassin,
}

type Card = {
  word: string;
  type: CardType;
  isSelected: boolean;
};

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
                textDecorationLine: card.isSelected ? "line-through" : "none",
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
  const [cards, setCards] = useState<Array<Card>>([]);
  const [loading, setLoading] = useState(true);

  const handleCardClick = (clickedIndex: number) => {
    setCards((prevCards) =>
      prevCards.map((card, index) =>
        index === clickedIndex
          ? { ...card, isSelected: !card.isSelected }
          : card
      )
    );
  };

  useEffect(() => {
    const initializeCards = async () => {
      try {
        const response = await fetch("/api/codenames/words");
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const { words } = (await response.json()) as { words: string[] };

        const newCards = words.map((word, index) => ({
          word,
          type: SHUFFLED_TYPES[index],
          isSelected: false,
        }));
        setCards(newCards);
      } catch (error) {
        console.error("Failed to load words:", error);
      }
      setLoading(false);
    };

    initializeCards();
  }, []);

  if (loading) {
    return <div>Loading words...</div>;
  }

  return (
    <div
      id="codenames-body"
      className="grid items-center min-h-screen min-w-full"
      style={{
        gridTemplateColumns: "2fr 6fr 2fr",
        gridTemplateRows: "1fr 7fr 2fr",
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
          cards={cards}
          cardType={CardType.Red}
        />
      </div>

      <div
        className="grid grid-cols-5 gap-2 justify-self-center"
        style={{
          gridArea: "center",
        }}
      >
        {cards.map((card, index) => {
          const style = card.isSelected
            ? SELECTED_CARD_STYLES[card.type]
            : UNSELECTED_CARD_STYLES[card.type];
          return (
            <div
              key={index}
              className={`p-4 h-22 w-34 rounded-sm flex items-center justify-center text-center cursor-pointer font-bold ${style}`}
              onClick={() => handleCardClick(index)}
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
          cards={cards}
          cardType={CardType.Blue}
        />
      </div>

      <div
        className="justify-self-center"
        style={{
          gridArea: "header",
        }}
      ></div>

      <div
        className="justify-self-center w-full flex justify-center"
        style={{
          gridArea: "footer",
        }}
      >
        <div className="text-md flex items-center h-[40px]">
          <input
            id="clue-input"
            type="text"
            placeholder="Clue"
            className="h-full mx-2 px-2 border-1 border-black bg-white py-1"
          />
          <button className="h-full text-white bg-green-700 hover:bg-green-800 cursor-pointer px-3 py-1.5 rounded-sm">
            Submit
          </button>
        </div>
      </div>
    </div>
  );
};
export default Codenames;
