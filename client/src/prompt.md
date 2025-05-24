Write a new game file boat.tsx. Here are the requirements:
- The aim of the game is to be the team that collects the most ducks. There should be an indication of the score on the screen.
- Like in pong, there are 1-4 teams. Each team has 1-6 players.
- Each team controls a single boat. All players have their own joystick. The joystick inputs should be summed up to move their team boat.
- Ducks and rocks float in the water. Boats can collide with rocks and pick up the ducks.
- You can use the image assets in client\public\boat.
- The game is 2d, top down.

Ask me questions about things that are unclear. After you are clear on the requirements, tell me your plan. I will review your plan and then you can start coding.


---

Boat Movement Mechanics:
How should the joystick inputs be summed? Should it be simple vector addition (all players' x and y components added together)?
I'm not sure about this. Use your best judgement.

Should the boat have momentum/inertia, or should it stop immediately when no input is provided?
It should have inertia.

Should the boat rotate to face the direction it's moving, or always face the same direction?
It should rotate to face the direction it's moving.

Duck Collection:
When a boat collides with a duck, should the duck disappear immediately or have some collection animation?
For now, it should disappear immediately.

Should ducks respawn after being collected? If so, where and how often?
No, they should not respawn.

Is there a maximum number of ducks on screen at once?
Start with a maximum of 24 ducks on screen at once.

Rock Collisions:
What happens when a boat hits a rock? Does it bounce off, stop, or slow down?
It should bounce off a little.

Can boats push through rocks with enough force (multiple players pushing)?
No.

Should rocks be stationary or can they float/drift slowly?
Stationary.

Game Flow:
Is there a time limit for the game, or does it continue until a certain score is reached?
For now, there should be no time limit. Continue until 5 points are reached.

Should there be a game over condition, or does it run indefinitely?
Explained above.

Should the game have a start/pause mechanism like the pong game?
Yes.

Visual Layout:
Should the game area be the same 600x600 pixels like pong?
No, make it larger. I'll play on a desktop screen so make it wider than it is tall.

How large should the boats, ducks, and rocks be relative to the game area?
Start with your best judgement, we'll update it as we go along.

Should there be any UI elements besides the score display (like team names, timer, etc.)?
Team name, score, timer.

Team Colors:
I see there are ship images in blue, green, red, and yellow. Should these correspond to the team colors like in pong?
Yes.

Should teams without players (dummy teams) have their boats removed from the game?
Yes.
