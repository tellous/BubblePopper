# Bubble Popper - Game Design Document

## 1. Overview

Bubble Popper is a fast-paced arcade game for Horizon Worlds where players compete to pop bubbles matching their assigned color within a time limit. Players score points for each correct bubble popped, aiming for the highest score on the world leaderboards. The game features special bubble types, social tracking, and distinct interactions for VR and non-VR players.

## 2. Gameplay

### 2.1. Core Loop

1.  **Start:** Players initiate a game round by pressing a start button.
2.  **Assign Color:** Each player is assigned a unique color at the start of the round. This color is visibly associated with the player (e.g., UI element near their name).
3.  **Spawn Bubbles:** Bubbles of various colors, including special types, continuously spawn from designated points around a central area.
4.  **Pop Bubbles:** Players interact with bubbles:
    *   **VR:** Touch bubbles with their hands.
    *   **Non-VR:** Tap bubbles using a raycast interaction.
5.  **Scoring:** Popping a bubble matching the player's assigned color awards points and updates their score display. Popping incorrect colors has no effect. Special bubbles may have different scoring rules.
6.  **Timer:** A visible timer counts down the round duration.
7.  **End:** The round ends when the timer reaches zero.
8.  **Results:** Scores are saved to Player Persistent Variables (PPV) and updated on world leaderboards.

### 2.2. Player Interaction

*   **VR:** Direct hand touch for popping bubbles. Haptic feedback is provided upon touching a correct bubble.
*   **Non-VR (Tapping):** A raycast gizmo is used to aim and "tap" bubbles from a distance.

### 2.3. Bubbles

*   **Spawning:** Bubbles spawn continuously around a central point, maintaining a minimum distance (e.g., 0.5 meters). Spawn locations should feel varied.
*   **Movement:** Bubbles should move realistically (e.g., float upwards with slight variations in speed and direction). A large number of bubbles should be present simultaneously.
*   **Standard Bubbles:** Match player colors. Only the player with the matching color can pop them for points.
*   **Special Bubbles (Gold?):**
    *   Move faster than standard bubbles.
    *   Award higher score values.
    *   Can be popped by *any* player, regardless of their assigned color.
*   **Bad Bubbles (Dark?):**
    *   Popping these bubbles temporarily stuns the player (details TBD - e.g., brief inability to interact).

## 3. Features

### 3.1. Timer

*   A custom UI element clearly displays the remaining time in the round.
*   Initial round duration: 60 seconds (adjustable).

### 3.2. Scoring System

*   A custom UI element displays the player's current score for the round.
*   Score updates instantly upon popping a correct bubble.
*   Final scores are saved at the end of the round.

### 3.3. Leaderboards

*   **World Leaderboards:**
    *   `TotalBubblesPopped`: Tracks the cumulative number of correct bubbles popped by a player across all sessions.
    *   `MostWins`: Tracks the number of rounds won (highest score in a round).
    *   `MostSocial`: Tracks the number of unique players someone has played a round with.
*   Leaderboard keys must be distinct from PPV keys.

### 3.4. Player Persistent Variables (PPV)

*   Store the player's score at the end of each round.
*   Store a list (serialized, e.g., JSON) of unique player usernames encountered (`metPlayers`) to calculate the `MostSocial` leaderboard stat. The PPV key for this should be distinct from the leaderboard key.

### 3.5. Player Color Indicator

*   A visual element (e.g., a colored border or background panel) associated with each player's nameplate or avatar indicates their assigned color for the current round, visible to all players.

### 3.6. Audio-Visual Feedback

*   **VFX:** Visual effects upon bubble pop (differentiate correct, special, bad pops). Effects for bubble spawning. Stun effect visuals.
*   **SFX:** Sound effects for bubble pop (correct, special, bad), bubble spawn, round start/end, timer ticks, UI interactions.
*   **Haptics:** VR players receive haptic feedback when their hands touch a poppable bubble.

## 4. Technical Requirements

### 4.1. Platform & Scripting

*   **Platform:** Meta Horizon Worlds
*   **Scripting:** TypeScript
*   **Architecture:**
    *   `Game.ts`: Server-authoritative logic (game state, scoring, round management, leaderboard updates, bubble spawning).
    *   `Local.ts`: Client-side logic (input handling - tapping/touching, UI updates based on local player actions, haptics, requesting pops via network events). Use `getLocalPlayer()` for player identification.
    *   `GameConstants`: Utilize for reusable code and constants.
    *   `Events.ts`: Define events for client-server communication (e.g., `RequestPopBubble`, `UpdateScoreUI`, `AssignColor`).
*   **Dependencies:** Utilize Horizon Worlds Core SDK (`horizon/core`, `horizon/ui`, etc.). Reference `HorizonWorldsSnippets` for implementation examples.

### 4.2. Interaction

*   **Tapping:** Implement using a raycast gizmo originating from the player/camera.
*   **Touching:** Utilize collision detection between player hands (VR) and bubble colliders.

### 4.3. Configuration

*   Game settings (round time, bubble spawn rate, bubble speed ranges, score values, stun duration, spawn radius) should be easily configurable, preferably in `GameConstants.ts` or similar module.

## 5. Assets

*   **Models:** Bubble model(s), Start Button model.
*   **UI:** Custom UI panels/elements for Timer, Score, Player Color Indicators.
*   **VFX:** Particle effects for bubble pops (standard, special, bad), spawn effect, stun effect.
*   **SFX:** Sound files for interactions and game events (as listed in 3.6).
*   **Props:** Define necessary script properties for linking assets (VFX, SFX emitters, UI elements, spawn points). Haptics do not require prop definitions.

## 6. Future Considerations / TODO

*   Refine stun mechanic details.
*   Balance bubble spawn rate, speed, and scoring.
*   Add visual polish to UI and effects.
*   Consider different game modes or variations.