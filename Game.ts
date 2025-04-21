import * as hz from 'horizon/core';
import * as GameConstants from './GameConstants';
import { ScoreEvent, AssignDataEvent, GameOverResetCameraEvent, ForceGameOverEvent, PlayerColorAssignEvent, RequestPlayerColorEvent } from './Events';

class Game extends hz.Component<typeof Game> {
  static propsDefinition = {
    local1: { type: hz.PropTypes.Entity },
    local2: { type: hz.PropTypes.Entity },
    local3: { type: hz.PropTypes.Entity },
    local4: { type: hz.PropTypes.Entity },
    startButton: { type: hz.PropTypes.Entity },
    popTrigger: { type: hz.PropTypes.Entity },
    spawnPoint: { type: hz.PropTypes.Entity },
    bubblePrefab: { type: hz.PropTypes.Asset },
    timerText: { type: hz.PropTypes.Entity }
  };

  private timeRemaining = 0;
  private spawnHandle?: number;
  private countdownHandle?: number;
  private scores: Map<hz.Player, number> = new Map();
  private spawners: Map<hz.Entity, hz.SpawnController> = new Map();
  private playerColorMap: Map<string, hz.Player> = new Map();
  private playerEntityMap: Map<hz.Entity, hz.Player> = new Map();
  private activePlayers: hz.Player[] = [];
  private gameInProgress = false;

  start() { }

  preStart() {
    // Start button
    this.connectCodeBlockEvent(
      this.props.startButton!,
      hz.CodeBlockEvents.OnPlayerEnterTrigger,
      this.startGame.bind(this)
    );

    // Track players entering and exiting the world
    this.connectCodeBlockEvent(
      this.entity,
      hz.CodeBlockEvents.OnPlayerEnterWorld,
      this.onPlayerEnterWorld.bind(this)
    );

    this.connectCodeBlockEvent(
      this.entity,
      hz.CodeBlockEvents.OnPlayerExitWorld,
      this.onPlayerExitWorld.bind(this)
    );

    // Pop trigger
    this.connectCodeBlockEvent(
      this.props.popTrigger!,
      hz.CodeBlockEvents.OnEntityEnterTrigger,
      (bubble: hz.Entity) => {
        this.cleanSpawner(bubble);
      }
    );

    // Handle scoring
    this.connectLocalBroadcastEvent(
      ScoreEvent,
      this.registerScore.bind(this)
    );

    this.connectNetworkBroadcastEvent(
      ForceGameOverEvent,
      this.endGame.bind(this)
    );
    
    // Handle color requests when ownership transfers
    this.connectNetworkBroadcastEvent(
      RequestPlayerColorEvent,
      this.handleColorRequest.bind(this)
    );
  }

  private onPlayerEnterWorld(player: hz.Player) {
    // Add player to active players list if not already present
    if (!this.activePlayers.some(p => p.id === player.id)) {
      this.activePlayers.push(player);
    }
  }

  private onPlayerExitWorld(player: hz.Player) {
    // Remove the player from the active players list
    this.activePlayers = this.activePlayers.filter(p => p.id !== player.id);

    // Remove this player from color map
    Array.from(this.playerColorMap.entries()).forEach(([color, assignedPlayer]) => {
      if (assignedPlayer.id === player.id) {
        this.playerColorMap.delete(color);
      }
    });
    
    // Release any local entities owned by this player
    Array.from(this.playerEntityMap.entries()).forEach(([entity, assignedPlayer]) => {
      if (assignedPlayer.id === player.id) {
        // Set entity back to server ownership
        entity.owner.set(this.world.getServerPlayer());
        // Remove from player-entity mapping
        this.playerEntityMap.delete(entity);
      }
    });
  }

  private startGame(player: hz.Player) {
    // Don't start if game is already in progress
    if (this.gameInProgress) {
      return;
    }

    const usedLocalEntites = Array.from(this.playerEntityMap.keys());

    if (usedLocalEntites.length < 4) {
      //Get an unused local entity
      const localEntities = [this.props.local1!, this.props.local2!, this.props.local3!, this.props.local4!];
      const localEntity = localEntities.find(entity => !usedLocalEntites.includes(entity));
      if (localEntity) {
        this.playerEntityMap.set(localEntity, player);
        localEntity.owner.set(player);
      }
    }

    //Shuffle the color palette
    GameConstants.COLOR_PALETTE.sort(() => Math.random() - 0.5);

    this.gameInProgress = true;
    this.scores.clear();
    this.playerColorMap.clear();

    // Assign colors to all active players
    this.activePlayers.forEach(player => {
      this.assignColorToPlayer(player);
    });

    this.timeRemaining = GameConstants.ROUND_DURATION;
    this.updateTimerUI();

    this.spawnHandle = this.async.setInterval(
      () => this.spawnBubble(),
      GameConstants.SPAWN_INTERVAL * 1000
    );

    this.countdownHandle = this.async.setInterval(() => {
      this.timeRemaining--;
      this.updateTimerUI();
      if (this.timeRemaining <= 0) {
        this.timesUp();
      }
    }, 1000);
  }

  private assignColorToPlayer(player: hz.Player) {
    // Skip if player is not valid
    if (!player) return;

    // Get available colors (not assigned to any player)
    const usedColors = Array.from(this.playerColorMap.keys());
    const availableColors = GameConstants.COLOR_PALETTE.filter(color => !usedColors.includes(color));

    // If no colors available, we'll have to reuse one
    const colorToAssign = availableColors.length > 0
      ? availableColors[0]  // Use first available color
      : GameConstants.COLOR_PALETTE[this.activePlayers.indexOf(player) % GameConstants.COLOR_PALETTE.length]; // Cycle through colors

    // Assign the color to this player
    this.playerColorMap.set(colorToAssign, player);

    // Broadcast the color assignment to all clients
    this.sendNetworkBroadcastEvent(PlayerColorAssignEvent, {
      color: colorToAssign
    });
  }

  private updateTimerUI() {
    const txt = this.props.timerText!.as(hz.TextGizmo);
    txt?.text.set(`${this.timeRemaining}`);
  }

  private spawnBubble() {
    const center = this.props.spawnPoint!.position.get();
    // choose bubble type
    const rnd = Math.random();
    const isBad = false//rnd < GameConstants.BAD_BUBBLE_CHANCE;
    const isSpecial = !isBad && rnd < GameConstants.BAD_BUBBLE_CHANCE + GameConstants.SPECIAL_BUBBLE_CHANCE;
    // compute position & rotation
    const randomVec = new hz.Vec3(
      Math.random() * 2 - 1,
      Math.random() * 2 - 1,
      Math.random() * 2 - 1
    ).normalize().mul(GameConstants.SPAWN_RADIUS);
    const pos = center.add(randomVec);
    const spawner = new hz.SpawnController(
      this.props.bubblePrefab!,
      pos,
      hz.Quaternion.zero,
      hz.Vec3.one
    );
    spawner.spawn().then(() => {
      spawner.rootEntities.get().forEach(ent => {
        this.spawners.set(ent, spawner);

        let color: string;
        let player: hz.Player | undefined;

        if (isBad) {
          // Bad bubble (brown)
          color = '#8B4513';
        } else if (isSpecial) {
          // Special bubble (gold)
          color = '#FFD700';
        } else {
          // Regular bubble - only use colors assigned to active players
          const assignedColors = Array.from(this.playerColorMap.keys());
          
          // If no colors are assigned (no players), use the first color from palette
          if (assignedColors.length === 0) {
            color = GameConstants.COLOR_PALETTE[0];
          } else {
            // Pick a random color from the assigned colors
            color = assignedColors[Math.floor(Math.random() * assignedColors.length)];
          }
          // Get the player assigned to this color
          player = this.playerColorMap.get(color);
        }

        this.sendLocalEvent(ent, AssignDataEvent, {
          player: player,
          color: color,
          score: isBad ? -1 : isSpecial ? 2 : 1
        });
      });
    });
  }

  private timesUp() {
    // Broadcast event to reset camera to first person view
    this.sendLocalBroadcastEvent(GameOverResetCameraEvent, {});

    this.endGame();
  }

  private endGame() {
    if (!this.gameInProgress) return;

    if (this.spawnHandle) this.async.clearInterval(this.spawnHandle);
    if (this.countdownHandle) this.async.clearInterval(this.countdownHandle);

    const txt = this.props.timerText!.as(hz.TextGizmo);
    txt?.text.set(``);

    const localEntities = Array.from(this.playerEntityMap.keys());
    localEntities.forEach(entity => {
      entity.owner.set(this.world.getServerPlayer());
    });
    // Clear the player-entity mapping
    this.playerEntityMap.clear();

    // Track players who participated in this round for the social leaderboard
    let winners: hz.Player[] = [];
    let highestScore = 0;

    // Persist scores and update leaderboards
    Array.from(this.scores.entries()).forEach((entry) => {
      const player = entry[0];
      const score = entry[1];

      // Check for the winner(s)
      if (score > highestScore) {
        highestScore = score;
        winners = [player];
      } else if (score === highestScore) {
        winners.push(player);
      }

      // Update player's total bubble count PPV
      const currentBubbles = this.world.persistentStorage.getPlayerVariable<number>(
        player,
        GameConstants.MostPopsPpv
      ) || 0;

      this.world.persistentStorage.setPlayerVariable(
        player,
        GameConstants.MostPopsPpv,
        currentBubbles + score
      );

      // Update cumulative leaderboard for total bubbles popped
      this.world.leaderboards.setScoreForPlayer(
        GameConstants.MostPopsLeaderboard,
        player,
        currentBubbles + score,
        false
      );

      // Update unique players met for social leaderboard
      this.updateSocialLeaderboard(player);
    });

    // Update wins leaderboard for the winner(s)
    winners.forEach(player => {
      const currentWins = this.world.persistentStorage.getPlayerVariable<number>(
        player,
        GameConstants.MostWinsPpv
      ) || 0;

      this.world.persistentStorage.setPlayerVariable(
        player,
        GameConstants.MostWinsPpv,
        currentWins + 1
      );

      this.world.leaderboards.setScoreForPlayer(
        GameConstants.MostWinsLeaderboard,
        player,
        currentWins + 1,
        false
      );
    });

    // Reset game state
    this.gameInProgress = false;
    this.scores.clear();
    this.playerColorMap.clear();
  }

  private updateSocialLeaderboard(player: hz.Player) {
    // Get the current list of players this player has met
    let metPlayers: string[] = this.world.persistentStorage.getPlayerVariable<string[]>(
      player,
      GameConstants.PlayersMetPpv
    ) || [];

    // Add all active players from this round to the list (except the player themselves)
    const playersToAdd = this.activePlayers
      .filter(p => p.id !== player.id)
      .map(p => p.name.get());

    // Add only new players
    let newPlayerMet = false;
    playersToAdd.forEach(name => {
      if (!metPlayers.includes(name)) {
        metPlayers.push(name);
        newPlayerMet = true;
      }
    });

    // Only update if we have new players
    if (newPlayerMet) {
      // Save the updated list
      this.world.persistentStorage.setPlayerVariable(
        player,
        GameConstants.PlayersMetPpv,
        metPlayers
      );

      // Update social leaderboard with count of unique players met
      this.world.leaderboards.setScoreForPlayer(
        GameConstants.MostSocialLeaderboard,
        player,
        metPlayers.length,
        false
      );
    }
  }

  private registerScore(data: { player: hz.Player, score: number, entity: hz.Entity }) {
    this.scores.set(data.player, (this.scores.get(data.player) || 0) + data.score);

    this.cleanSpawner(data.entity);
  }

  private cleanSpawner = (bubble: hz.Entity) => {
    const spawner = this.spawners.get(bubble);
    if (spawner) {
      spawner.dispose();
      this.spawners.delete(bubble);
    }
  }

  private handleColorRequest(data: { player: hz.Player }) {
    // Only respond if game is in progress and we have color assignments
    if (!this.gameInProgress || this.playerColorMap.size === 0) {
      return;
    }

    const player = data.player;
    if (!player) return;
    
    // Find the color assigned to this player
    let playerColor: string | undefined;
    Array.from(this.playerColorMap.entries()).forEach(([color, assignedPlayer]) => {
      if (assignedPlayer.id === player.id) {
        playerColor = color;
      }
    });
    
    // If player has a color assigned, send it to all clients
    if (playerColor) {
      this.sendNetworkBroadcastEvent(PlayerColorAssignEvent, {
        color: playerColor
      });
    } else {
      // If player doesn't have a color yet, assign one
      this.assignColorToPlayer(player);
    }
  }
}
hz.Component.register(Game);