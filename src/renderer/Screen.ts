export interface ScreenLayoutConfig {
  title: string;
  showBackButton?: boolean;
  onBack?: () => void;
  primaryAction?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
  };
  // Optional secondary action (e.g., statistics or reset)
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
}

export interface Screen {
  /**
   * Returns the configuration for the global shell.
   * Called by ScreenManager before mounting.
   */
  getLayoutConfig(): ScreenLayoutConfig;

  /**
   * Called when the screen is mounted.
   * Returns the DOM element to inject into #main-content.
   */
  mount(): HTMLElement | Promise<HTMLElement>;

  /**
   * Called when the screen is unmounted.
   * Cleanup listeners here.
   */
  unmount(): void;
}
