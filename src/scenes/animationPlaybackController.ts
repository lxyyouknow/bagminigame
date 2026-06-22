interface PlaybackNode {
  playing: boolean;
  destroyed?: boolean;
  play(): void;
  stop(): void;
}

export class AnimationPlaybackController {
  private pausedAnimations = new Set<PlaybackNode>();

  pause(roots: readonly unknown[]): void {
    for (const root of roots) this.visit(root);
  }

  resume(): void {
    for (const animation of this.pausedAnimations) {
      if (!animation.destroyed) animation.play();
    }
    this.pausedAnimations.clear();
  }

  clear(): void {
    this.pausedAnimations.clear();
  }

  private visit(node: unknown): void {
    if (!node || typeof node !== "object") return;
    if (isPlaybackNode(node) && node.playing) {
      this.pausedAnimations.add(node);
      node.stop();
    }
    const children = (node as { children?: unknown }).children;
    if (Array.isArray(children)) {
      for (const child of children) this.visit(child);
    }
  }
}

function isPlaybackNode(node: object): node is PlaybackNode {
  const candidate = node as Partial<PlaybackNode>;
  return typeof candidate.playing === "boolean"
    && typeof candidate.play === "function"
    && typeof candidate.stop === "function";
}
