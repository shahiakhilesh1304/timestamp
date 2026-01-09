/**
 * Generic Tabs Utility Tests
 * @vitest-environment jsdom
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildTabList, buildTabPanel, type TabConfig, type TabController, type TabPanelController } from './tabs';

describe('buildTabList', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  const createTabs = (): TabConfig<'tab1' | 'tab2' | 'tab3'>[] => [
    { id: 'tab1', label: 'Tab 1', selected: true },
    { id: 'tab2', label: 'Tab 2', selected: false },
    { id: 'tab3', label: 'Tab 3', selected: false },
  ];

  it('should create tab list with correct ARIA attributes', () => {
    const tabs = createTabs();
    const onTabChange = vi.fn();

    const controller = buildTabList({
      tabs,
      onTabChange,
      ariaLabel: 'Test tabs',
    });

    const tabList = controller.getTabList();
    expect(tabList.getAttribute('role')).toBe('tablist');
    expect(tabList.getAttribute('aria-label')).toBe('Test tabs');

    controller.destroy();
  });

  it('should create tabs with correct ARIA attributes', () => {
    const tabs = createTabs();
    const onTabChange = vi.fn();

    const controller = buildTabList({
      tabs,
      onTabChange,
      ariaLabel: 'Test tabs',
    });

    const tabList = controller.getTabList();
    const tabButtons = tabList.querySelectorAll('[role="tab"]');

    expect(tabButtons).toHaveLength(3);

    // First tab should be selected
    expect(tabButtons[0].getAttribute('aria-selected')).toBe('true');
    expect(tabButtons[0].getAttribute('tabindex')).toBe('0');
    expect(tabButtons[0].getAttribute('id')).toBe('tab-tab1');
    expect(tabButtons[0].getAttribute('aria-controls')).toBe('tabpanel-tab1');

    // Other tabs should not be selected
    expect(tabButtons[1].getAttribute('aria-selected')).toBe('false');
    expect(tabButtons[1].getAttribute('tabindex')).toBe('-1');

    controller.destroy();
  });

  it('should call onTabChange when tab is clicked', () => {
    const tabs = createTabs();
    const onTabChange = vi.fn();

    const controller = buildTabList({
      tabs,
      onTabChange,
      ariaLabel: 'Test tabs',
    });

    const tabList = controller.getTabList();
    const tabButtons = tabList.querySelectorAll('[role="tab"]');

    // Click second tab
    (tabButtons[1] as HTMLElement).click();

    expect(onTabChange).toHaveBeenCalledWith('tab2');
    expect(tabButtons[1].getAttribute('aria-selected')).toBe('true');
    expect(tabButtons[0].getAttribute('aria-selected')).toBe('false');

    controller.destroy();
  });

  it('should not call onTabChange when clicking already active tab', () => {
    const tabs = createTabs();
    const onTabChange = vi.fn();

    const controller = buildTabList({
      tabs,
      onTabChange,
      ariaLabel: 'Test tabs',
    });

    const tabList = controller.getTabList();
    const tabButtons = tabList.querySelectorAll('[role="tab"]');

    // Click already selected tab
    (tabButtons[0] as HTMLElement).click();

    expect(onTabChange).not.toHaveBeenCalled();

    controller.destroy();
  });

  it('should activate tab on Enter key', () => {
    const tabs = createTabs();
    const onTabChange = vi.fn();

    const controller = buildTabList({
      tabs,
      onTabChange,
      ariaLabel: 'Test tabs',
    });

    const tabList = controller.getTabList();
    const tabButtons = tabList.querySelectorAll('[role="tab"]');

    // Dispatch Enter key on second tab
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    tabButtons[1].dispatchEvent(event);

    expect(onTabChange).toHaveBeenCalledWith('tab2');

    controller.destroy();
  });

  it('should activate tab on Space key', () => {
    const tabs = createTabs();
    const onTabChange = vi.fn();

    const controller = buildTabList({
      tabs,
      onTabChange,
      ariaLabel: 'Test tabs',
    });

    const tabList = controller.getTabList();
    const tabButtons = tabList.querySelectorAll('[role="tab"]');

    // Dispatch Space key on second tab
    const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true });
    tabButtons[1].dispatchEvent(event);

    expect(onTabChange).toHaveBeenCalledWith('tab2');

    controller.destroy();
  });

  it('should set active tab programmatically', () => {
    const tabs = createTabs();
    const onTabChange = vi.fn();

    const controller = buildTabList({
      tabs,
      onTabChange,
      ariaLabel: 'Test tabs',
    });

    controller.setActiveTab('tab3');

    expect(onTabChange).toHaveBeenCalledWith('tab3');
    expect(controller.getActiveTab()).toBe('tab3');

    controller.destroy();
  });

  it('should return current active tab', () => {
    const tabs = createTabs();
    const onTabChange = vi.fn();

    const controller = buildTabList({
      tabs,
      onTabChange,
      ariaLabel: 'Test tabs',
    });

    expect(controller.getActiveTab()).toBe('tab1');

    const tabList = controller.getTabList();
    const tabButtons = tabList.querySelectorAll('[role="tab"]');
    (tabButtons[1] as HTMLElement).click();

    expect(controller.getActiveTab()).toBe('tab2');

    controller.destroy();
  });

  it('should use custom className', () => {
    const tabs = createTabs();
    const onTabChange = vi.fn();

    const controller = buildTabList({
      tabs,
      onTabChange,
      ariaLabel: 'Test tabs',
      className: 'landing-tabs',
    });

    const tabList = controller.getTabList();
    expect(tabList.className).toBe('landing-tabs');

    const tabButton = tabList.querySelector('[role="tab"]');
    expect(tabButton?.className).toBe('landing-tabs-tab');

    controller.destroy();
  });

  it('should use custom idPrefix', () => {
    const tabs = createTabs();
    const onTabChange = vi.fn();

    const controller = buildTabList({
      tabs,
      onTabChange,
      ariaLabel: 'Test tabs',
      idPrefix: 'landing',
    });

    const tabList = controller.getTabList();
    const tabButton = tabList.querySelector('[role="tab"]');

    expect(tabButton?.getAttribute('id')).toBe('landing-tab1');
    expect(tabButton?.getAttribute('aria-controls')).toBe('landingpanel-tab1');

    controller.destroy();
  });

  it('should render icon when provided as string', () => {
    const tabs: TabConfig<'tab1'>[] = [{ id: 'tab1', label: 'Tab 1', selected: true, icon: '🏠' }];
    const onTabChange = vi.fn();

    const controller = buildTabList({
      tabs,
      onTabChange,
      ariaLabel: 'Test tabs',
    });

    const tabList = controller.getTabList();
    const iconSpan = tabList.querySelector('.tabs-tab-icon');

    expect(iconSpan).not.toBeNull();
    expect(iconSpan?.innerHTML).toBe('🏠');
    expect(iconSpan?.getAttribute('aria-hidden')).toBe('true');

    controller.destroy();
  });

  it('should render icon when provided as HTMLElement', () => {
    const iconElement = document.createElement('svg');
    iconElement.setAttribute('data-testid', 'icon-svg');

    const tabs: TabConfig<'tab1'>[] = [{ id: 'tab1', label: 'Tab 1', selected: true, icon: iconElement }];
    const onTabChange = vi.fn();

    const controller = buildTabList({
      tabs,
      onTabChange,
      ariaLabel: 'Test tabs',
    });

    const tabList = controller.getTabList();
    const iconSpan = tabList.querySelector('.tabs-tab-icon');

    expect(iconSpan).not.toBeNull();
    expect(iconSpan?.querySelector('[data-testid="icon-svg"]')).not.toBeNull();

    controller.destroy();
  });
});

describe('buildTabPanel', () => {
  it('should create panel with correct ARIA attributes', () => {
    const controller = buildTabPanel({
      id: 'test',
      visible: true,
    });

    const panel = controller.getPanel();
    expect(panel.getAttribute('role')).toBe('tabpanel');
    expect(panel.getAttribute('id')).toBe('tabpanel-test');
    expect(panel.getAttribute('aria-labelledby')).toBe('tab-test');
    expect(panel.getAttribute('tabindex')).toBe('0');
    expect(panel.hidden).toBe(false);
  });

  it('should be hidden when visible is false', () => {
    const controller = buildTabPanel({
      id: 'test',
      visible: false,
    });

    const panel = controller.getPanel();
    expect(panel.hidden).toBe(true);
    expect(controller.isVisible()).toBe(false);
  });

  it('should show and hide panel', () => {
    const controller = buildTabPanel({
      id: 'test',
      visible: false,
    });

    expect(controller.isVisible()).toBe(false);

    controller.show();
    expect(controller.isVisible()).toBe(true);
    expect(controller.getPanel().hidden).toBe(false);

    controller.hide();
    expect(controller.isVisible()).toBe(false);
    expect(controller.getPanel().hidden).toBe(true);
  });

  it('should set initial content', () => {
    const content = document.createElement('div');
    content.textContent = 'Test content';

    const controller = buildTabPanel({
      id: 'test',
      visible: true,
      content,
    });

    const panel = controller.getPanel();
    expect(panel.textContent).toBe('Test content');
  });

  it('should replace content', () => {
    const initialContent = document.createElement('div');
    initialContent.textContent = 'Initial';

    const controller = buildTabPanel({
      id: 'test',
      visible: true,
      content: initialContent,
    });

    const newContent = document.createElement('div');
    newContent.textContent = 'New content';
    controller.setContent(newContent);

    const panel = controller.getPanel();
    expect(panel.textContent).toBe('New content');
  });

  it('should use custom className', () => {
    const controller = buildTabPanel({
      id: 'test',
      visible: true,
      className: 'landing-tabs',
    });

    const panel = controller.getPanel();
    expect(panel.className).toBe('landing-tabs-tabpanel');
  });

  it('should use custom idPrefix', () => {
    const controller = buildTabPanel({
      id: 'test',
      visible: true,
      idPrefix: 'landing',
    });

    const panel = controller.getPanel();
    expect(panel.getAttribute('id')).toBe('landingpanel-test');
    expect(panel.getAttribute('aria-labelledby')).toBe('landing-test');
  });
});

describe('Tab list and panel integration', () => {
  let controller: TabController<'tab1' | 'tab2'>;
  let panel1: TabPanelController;
  let panel2: TabPanelController;

  beforeEach(() => {
    const onTabChange = (tabId: 'tab1' | 'tab2') => {
      if (tabId === 'tab1') {
        panel1.show();
        panel2.hide();
      } else {
        panel1.hide();
        panel2.show();
      }
    };

    controller = buildTabList({
      tabs: [
        { id: 'tab1', label: 'Tab 1', selected: true },
        { id: 'tab2', label: 'Tab 2', selected: false },
      ],
      onTabChange,
      ariaLabel: 'Test tabs',
    });

    panel1 = buildTabPanel({ id: 'tab1', visible: true });
    panel2 = buildTabPanel({ id: 'tab2', visible: false });
  });

  afterEach(() => {
    controller.destroy();
  });

  it('should show correct panel when tab is clicked', () => {
    expect(panel1.isVisible()).toBe(true);
    expect(panel2.isVisible()).toBe(false);

    const tabList = controller.getTabList();
    const tabButtons = tabList.querySelectorAll('[role="tab"]');
    (tabButtons[1] as HTMLElement).click();

    expect(panel1.isVisible()).toBe(false);
    expect(panel2.isVisible()).toBe(true);
  });

  it('should have correct ARIA relationships', () => {
    const tabList = controller.getTabList();
    const tab1Button = tabList.querySelector('#tab-tab1');
    const tab2Button = tabList.querySelector('#tab-tab2');

    expect(tab1Button?.getAttribute('aria-controls')).toBe('tabpanel-tab1');
    expect(tab2Button?.getAttribute('aria-controls')).toBe('tabpanel-tab2');

    expect(panel1.getPanel().getAttribute('aria-labelledby')).toBe('tab-tab1');
    expect(panel2.getPanel().getAttribute('aria-labelledby')).toBe('tab-tab2');
  });
});
