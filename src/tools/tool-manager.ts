import type { ToolType } from '../types';

type ToolChangeListener = (tool: ToolType) => void;

export class ToolManager {
  private activeTool: ToolType = null;
  private readonly listeners: ToolChangeListener[] = [];

  getActiveTool(): ToolType {
    return this.activeTool;
  }

  setActiveTool(tool: ToolType): void {
    this.activeTool = tool;
    for (const listener of this.listeners) {
      listener(tool);
    }
  }

  onToolChange(listener: ToolChangeListener): void {
    this.listeners.push(listener);
  }

  isActive(tool: ToolType): boolean {
    return this.activeTool === tool;
  }
}
