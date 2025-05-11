export default function Home() {
  return (
    <div
      className="grid w-full h-full"
      style={{
        gridTemplateAreas: `
          "nav nav nav nav"
          "left left right right"
          "one two three four"
      `,
        gridTemplateColumns: "1fr 1fr 1fr 1fr",
        gridTemplateRows: "1fr 5fr 4fr",
      }}
    >
      <div
        className="flex flex-col items-center justify-center w-full h-full"
        style={{ gridArea: "left" }}
      >
        <div>1. Connect to the wifi network</div>
        <div id="qr-wifi" className="w-[300px] h-[300px]"></div>
      </div>
      <div
        className="flex flex-col items-center justify-center w-full h-full"
        style={{ gridArea: "right" }}
      >
        <div>2. Join the game</div>
        <div id="qr-joinurl" className="w-[300px] h-[300px]"></div>
      </div>
      <div
        className="flex flex-col items-center justify-start w-full h-full"
        style={{ gridArea: "one" }}
      >
        <div>Team 1</div>
      </div>
      <div
        className="flex flex-col items-center justify-start w-full h-full"
        style={{ gridArea: "two" }}
      >
        <div>Team 2</div>
      </div>
      <div
        className="flex flex-col items-center justify-start w-full h-full"
        style={{ gridArea: "three" }}
      >
        <div>Team 3</div>
      </div>
      <div
        className="flex flex-col items-center justify-start w-full h-full"
        style={{ gridArea: "four" }}
      >
        <div>Team 4</div>
      </div>
    </div>
  );
}
