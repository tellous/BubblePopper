import * as hz from 'horizon/core';

export const BubbleTappedEvent = new hz.LocalEvent<{ player: hz.Player }>();

export const AssignDataEvent = new hz.LocalEvent<{ player?: hz.Player; color: string, score: number }>();

export const ScoreEvent = new hz.LocalEvent<{ player: hz.Player; score: number, entity: hz.Entity }>();

export const GameOverResetCameraEvent = new hz.LocalEvent();

export const ForceGameOverEvent = new hz.NetworkEvent('ForceGameOver');

// New event for assigning colors to players
export const PlayerColorAssignEvent = new hz.NetworkEvent<{ color: string }>('PlayerColorAssign');

// New event for requesting color information when ownership transfers
export const RequestPlayerColorEvent = new hz.NetworkEvent<{ player: hz.Player }>('RequestPlayerColor');