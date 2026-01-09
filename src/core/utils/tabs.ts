/**
 * Generic Tabs Utility - WAI-ARIA tabs pattern with keyboard navigation.
 *
 * Provides reusable tab list and panel builders for accessible tab interfaces.
 * Used by landing page for Help/FAQ navigation.
 *
 * @see https://www.w3.org/WAI/ARIA/apg/patterns/tabs/
 */

import type { RovingTabindexController } from '@core/utils/accessibility/roving-tabindex';
import { createRovingTabindex } from '@core/utils/accessibility/roving-tabindex';

/**
 * Configuration for a single tab.
 */
export interface TabConfig<T extends string = string> {
  /** Unique tab identifier */
  id: T;
  /** Display label for the tab */
  label: string;
  /** Whether this tab is initially selected */
  selected: boolean;
  /** Optional icon element or HTML string */
  icon?: string | HTMLElement;
}

/**
 * Options for creating a tab list.
 */
export interface TabListOptions<T extends string = string> {
  /** Tab configurations */
  tabs: TabConfig<T>[];
  /** Callback when a tab is activated */
  onTabChange: (tabId: T) => void;
  /** Accessible label for the tab list */
  ariaLabel: string;
  /** Optional CSS class for the tab list container */
  className?: string;
  /** Optional prefix for tab IDs (defaults to 'tab') */
  idPrefix?: string;
}

/**
 * Controller for managing tab UI and keyboard navigation.
 */
export interface TabController<T extends string = string> {
  /** Get the tab list element */
  getTabList(): HTMLElement;
  /** Set active tab programmatically */
  setActiveTab(tabId: T): void;
  /** Get current active tab ID */
  getActiveTab(): T;
  /** Clean up resources */
  destroy(): void;
}

/**
 * Build tablist with WAI-ARIA attributes and keyboard navigation.
 * @param options - Tab configurations and change callback
 * @returns Controller for tab management
 * @remarks Roving tabindex ensures only one tab is tabbable at a time
 */
export function buildTabList<T extends string = string>(options: TabListOptions<T>): TabController<T> {
  const { tabs, onTabChange, ariaLabel, className = 'tabs', idPrefix = 'tab' } = options;

  const tabList = document.createElement('div');
  tabList.setAttribute('role', 'tablist');
  tabList.setAttribute('aria-label', ariaLabel);
  tabList.className = className;

  const tabElements = new Map<T, HTMLElement>();
  let rovingController: RovingTabindexController | null = null;
  let currentTabId: T = tabs.find((t) => t.selected)?.id ?? tabs[0].id;

  for (const tab of tabs) {
    const button = document.createElement('button');
    button.setAttribute('role', 'tab');
    button.setAttribute('id', `${idPrefix}-${tab.id}`);
    button.setAttribute('aria-controls', `${idPrefix}panel-${tab.id}`);
    button.setAttribute('aria-selected', tab.selected ? 'true' : 'false');
    button.setAttribute('tabindex', tab.selected ? '0' : '-1');
    button.className = `${className}-tab`;
    button.type = 'button';

    // Add icon if provided
    if (tab.icon) {
      const iconSpan = document.createElement('span');
      iconSpan.className = `${className}-tab-icon`;
      iconSpan.setAttribute('aria-hidden', 'true');
      if (typeof tab.icon === 'string') {
        iconSpan.innerHTML = tab.icon;
      } else {
        iconSpan.appendChild(tab.icon);
      }
      button.appendChild(iconSpan);
    }

    // Add label
    const labelSpan = document.createElement('span');
    labelSpan.className = `${className}-tab-label`;
    labelSpan.textContent = tab.label;
    button.appendChild(labelSpan);

    button.addEventListener('click', () => {
      activateTab(tab.id);
    });

    button.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        activateTab(tab.id);
      }
    });

    tabElements.set(tab.id, button);
    tabList.appendChild(button);
  }

  function activateTab(tabId: T): void {
    const previousTabId = currentTabId;
    if (previousTabId === tabId) return;

    currentTabId = tabId;

    for (const [id, element] of tabElements) {
      const isSelected = id === tabId;
      element.setAttribute('aria-selected', isSelected ? 'true' : 'false');
    }

    onTabChange(tabId);
  }

  function setActiveTab(tabId: T): void {
    const tabElement = tabElements.get(tabId);
    if (!tabElement) return;

    const tabArray = Array.from(tabElements.values());
    const index = tabArray.indexOf(tabElement);

    if (index !== -1 && rovingController) {
      activateTab(tabId);
      rovingController.focusIndex(index);
    }
  }

  rovingController = createRovingTabindex({
    container: tabList,
    selector: '[role="tab"]',
    initialIndex: tabs.findIndex((t) => t.selected),
    wrap: true,
    orientation: 'horizontal',
  });

  return {
    getTabList(): HTMLElement {
      return tabList;
    },

    setActiveTab(tabId: T): void {
      setActiveTab(tabId);
    },

    getActiveTab(): T {
      return currentTabId;
    },

    destroy(): void {
      rovingController?.destroy();
      tabElements.clear();
    },
  };
}

/**
 * Options for creating a tab panel.
 */
export interface TabPanelOptions<T extends string = string> {
  /** Unique panel identifier (matches tab id) */
  id: T;
  /** Whether this panel is initially visible */
  visible: boolean;
  /** Content to display in the panel */
  content?: HTMLElement;
  /** Optional CSS class for the panel */
  className?: string;
  /** Optional prefix for panel IDs (defaults to 'tab') */
  idPrefix?: string;
}

/**
 * Controller for managing a tab panel's visibility.
 */
export interface TabPanelController {
  /** Get the panel element */
  getPanel(): HTMLElement;
  /** Show the panel */
  show(): void;
  /** Hide the panel */
  hide(): void;
  /** Set panel content */
  setContent(content: HTMLElement): void;
  /** Check if panel is visible */
  isVisible(): boolean;
}

/**
 * Build tabpanel with ARIA attributes and visibility management.
 * @param options - Panel ID, visibility, and optional content
 * @returns Controller for panel management
 * @remarks Hidden panels use `hidden` attribute to remove from accessibility tree
 */
export function buildTabPanel<T extends string = string>(options: TabPanelOptions<T>): TabPanelController {
  const { id, visible, content, className = 'tabs', idPrefix = 'tab' } = options;

  const panel = document.createElement('div');
  panel.setAttribute('role', 'tabpanel');
  panel.setAttribute('id', `${idPrefix}panel-${id}`);
  panel.setAttribute('aria-labelledby', `${idPrefix}-${id}`);
  panel.className = `${className}-tabpanel`;
  panel.setAttribute('tabindex', '0');

  if (!visible) {
    panel.hidden = true;
  }

  if (content) {
    panel.appendChild(content);
  }

  return {
    getPanel(): HTMLElement {
      return panel;
    },

    show(): void {
      panel.hidden = false;
    },

    hide(): void {
      panel.hidden = true;
    },

    setContent(newContent: HTMLElement): void {
      panel.innerHTML = '';
      panel.appendChild(newContent);
    },

    isVisible(): boolean {
      return !panel.hidden;
    },
  };
}
