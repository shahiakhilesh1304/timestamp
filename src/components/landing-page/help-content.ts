/**
 * Help Content Builder
 *
 * Creates the Help & FAQ content for the landing page help tab.
 * Content is derived from README.md and KEYBOARD-SHORTCUTS.md.
 */

import { getAllModeConfigs } from '@core/config/mode-config';
import { getIconSvg, type IconName } from '@core/utils/icons';

/**
 * FAQ item structure.
 */
export interface FAQItem {
  question: string;
  answer: string;
}

/**
 * Keyboard shortcut structure.
 */
export interface KeyboardShortcut {
  key: string;
  action: string;
  notes?: string;
  /** Grouping for shortcuts (all-modes or timer-only or theme-selector) */
  group: 'all-modes' | 'timer-only' | 'theme-selector';
}

/**
 * FAQ items derived from README and KEYBOARD-SHORTCUTS.md.
 */
export const FAQ_ITEMS: readonly FAQItem[] = [
  {
    question: 'What\'s the difference between the three countdown modes?',
    answer:
      'Local Time counts to a date in each viewer\'s timezone (great for New Year\'s Eve). Same Moment counts to a single instant worldwide (perfect for product launches). Timer counts down a fixed duration starting when opened.',
  },
  {
    question: 'How do I share a countdown?',
    answer:
      'Every configuration generates a shareable URL automatically. Just copy the URL from your browser\'s address bar or use the Share button. Anyone who opens the link sees the same countdown.',
  },
  {
    question: 'How do I use fullscreen mode?',
    answer:
      'Click the Fullscreen button or press F to enter fullscreen. In fullscreen, move your mouse to reveal controls. Press Escape, F, or click the exit button to leave fullscreen.',
  },
  {
    question: 'How do I install Timestamp as an app?',
    answer:
      'Timestamp is a Progressive Web App (PWA). On Desktop (Chrome/Edge), click ⊕ in the address bar. On iOS, use Share → "Add to Home Screen". On Android, use Menu → "Install app".',
  },
  {
    question: 'Does the app work offline?',
    answer:
      'Yes! After your first visit, Timestamp works without an internet connection. The app caches everything needed for offline use.',
  },
  {
    question: "Why don't keyboard shortcuts work on mobile?",
    answer:
      'Mobile devices use virtual keyboards that don\'t send Space/Enter key events the same way physical keyboards do. Timer controls remain accessible via touch (tap the play/pause/reset buttons).',
  },
  {
    question: "Why are some shortcuts only available in timer mode?",
    answer:
      "Wall-clock and absolute modes count to a specific calendar date/time. There's no concept of play/pause/reset — time keeps moving regardless. Timer mode is different because you control when it starts and stops. However, the F key works in all modes to toggle fullscreen.",
  },
  {
    question: 'Can I customize the keyboard shortcuts?',
    answer:
      'Not currently. Shortcuts are hardcoded for consistency. If there\'s demand for customization, we could add it in a future release.',
  },
  {
    question: 'This is awesome, I want to create a theme! How do I do that?',
    answer:
      'We\'d love to see your theme! Check out the <a href="https://github.com/chrisreddington/timestamp/blob/main/docs/THEME_DEVELOPMENT.md" target="_blank" rel="noopener noreferrer">Theme Development Guide</a> for a complete walkthrough. You can create a new theme with <code>npm run theme create &lt;name&gt;</code> and the guide explains the TimePageRenderer interface, theme lifecycle, and best practices.',
  },
  {
    question: 'How can I contribute to Timestamp?',
    answer:
      'Contributions are welcome! Check out <a href="https://github.com/chrisreddington/timestamp/blob/main/CONTRIBUTING.md" target="_blank" rel="noopener noreferrer">CONTRIBUTING.md</a> for guidelines on setting up your dev environment, code standards, and the pull request process. You can contribute themes, bug fixes, features, or documentation improvements.',
  },
  {
    question: 'I\'ve found a bug, or have a feature request! How do I let you know?',
    answer:
      'Please <a href="https://github.com/chrisreddington/timestamp/issues" target="_blank" rel="noopener noreferrer">open an issue on GitHub</a>! For bugs, include steps to reproduce and your browser/OS. For feature requests, describe the use case and how it would improve your experience. We review all issues and appreciate detailed feedback.',
  },
  {
    question: 'How can I support Timestamp?',
    answer:
      'Love Timestamp? <a href="https://github.com/chrisreddington/timestamp" target="_blank" rel="noopener noreferrer">Give us a star on GitHub</a> — it helps others discover the project! Share it with friends, colleagues, or on social media if you find it useful. You can also contribute by <a href="https://github.com/chrisreddington/timestamp/issues/new?template=bug_report.yml" target="_blank" rel="noopener noreferrer">reporting bugs</a>, <a href="https://github.com/chrisreddington/timestamp/issues/new?template=feature_request.yml" target="_blank" rel="noopener noreferrer">suggesting features</a>, or <a href="https://github.com/chrisreddington/timestamp/blob/main/docs/THEME_DEVELOPMENT.md" target="_blank" rel="noopener noreferrer">creating your own theme</a>. Every bit of feedback and support helps make Timestamp better!',
  },
] as const;

/**
 * Keyboard shortcuts for countdown modes and theme selector.
 */
export const KEYBOARD_SHORTCUTS: readonly KeyboardShortcut[] = [
  { key: 'F', action: 'Toggle fullscreen', notes: 'Works in any mode', group: 'all-modes' },
  { key: 'Escape', action: 'Exit fullscreen', notes: 'Also exits modals', group: 'all-modes' },
  { key: 'Space', action: 'Play/Pause toggle', notes: 'Works in fullscreen and normal view', group: 'timer-only' },
  { key: 'Enter', action: 'Reset timer', notes: 'Resets to original duration', group: 'timer-only' },
  { key: 'R', action: 'Reset timer', notes: 'Alternative to Enter', group: 'timer-only' },
  { key: 'F', action: 'Toggle favorite', notes: 'In theme picker', group: 'theme-selector' },
  { key: 'A', action: "Open author's GitHub Profile", notes: 'In theme picker', group: 'theme-selector' },
] as const;

/**
 * Build the complete help content element.
 */
export function buildHelpContent(): HTMLElement {
  const container = document.createElement('div');
  container.className = 'help-content';
  container.setAttribute('data-testid', 'help-content');

  container.appendChild(buildAboutSection());
  container.appendChild(buildModesSection());
  container.appendChild(buildKeyboardShortcutsSection());
  container.appendChild(buildFeaturesSection());
  container.appendChild(buildFAQSection());

  return container;
}

/**
 * Build the About section.
 */
function buildAboutSection(): HTMLElement {
  const section = document.createElement('section');
  section.className = 'help-section';
  section.setAttribute('aria-labelledby', 'help-about-title');

  section.innerHTML = `
    <h3 id="help-about-title" class="help-section-title">About Timestamp</h3>
    <p class="help-section-text">
      Timestamp is a countdown app where <strong>every countdown is a URL</strong>. 
      Pick a date, choose a theme, add a message - your countdown gets a unique link 
      that works for anyone who opens it.
    </p>
    <p class="help-section-text help-section-text--muted">
      Like what you see? You can support it by <a href="https://github.com/chrisreddington/timestamp" target="_blank" rel="noopener noreferrer">starring the repository</a>, 
      <a href="https://github.com/chrisreddington/timestamp/issues/new?template=bug_report.yml" target="_blank" rel="noopener noreferrer">reporting bugs</a>, 
      <a href="https://github.com/chrisreddington/timestamp/issues/new?template=feature_request.yml" target="_blank" rel="noopener noreferrer">requesting features</a>, 
      <a href="https://github.com/chrisreddington/timestamp/blob/main/CONTRIBUTING.md" target="_blank" rel="noopener noreferrer">contributing to the project</a>, 
      <a href="https://github.com/chrisreddington/timestamp/blob/main/docs/THEME_DEVELOPMENT.md" target="_blank" rel="noopener noreferrer">creating a theme</a>, 
      or simply sharing it with friends and colleagues!
    </p>
  `;

  return section;
}

/**
 * Build the Countdown Modes section.
 */
function buildModesSection(): HTMLElement {
  const section = document.createElement('section');
  section.className = 'help-section';
  section.setAttribute('aria-labelledby', 'help-modes-title');

  const title = document.createElement('h3');
  title.id = 'help-modes-title';
  title.className = 'help-section-title';
  title.textContent = 'Countdown Modes';
  section.appendChild(title);

  const modesList = document.createElement('div');
  modesList.className = 'help-modes-list';

  // Extended descriptions for help content (mode-config has short descriptions)
  const extendedDescriptions: Record<string, string> = {
    'Local Time': 'Countdown to a date in each viewer\'s timezone. Perfect for New Year\'s Eve — each timezone celebrates at their own midnight.',
    'Same Moment': 'Everyone counts to the same instant worldwide. Ideal for product launches, livestreams, or global events.',
    'Timer': 'Fixed duration countdown that starts when you open the link. Great for Pomodoro sessions, breaks, or meetings.',
  };

  for (const { config } of getAllModeConfigs()) {
    const modeItem = document.createElement('div');
    modeItem.className = 'help-mode-item';
    modeItem.innerHTML = `
      <span class="help-mode-icon" aria-hidden="true">${config.icon}</span>
      <div class="help-mode-content">
        <span class="help-mode-name">${config.displayName}</span>
        <span class="help-mode-subtitle">${config.subtitle}</span>
        <p class="help-mode-description">${extendedDescriptions[config.displayName]}</p>
      </div>
    `;
    modesList.appendChild(modeItem);
  }

  section.appendChild(modesList);
  return section;
}

/**
 * Build the Keyboard Shortcuts section.
 */
function buildKeyboardShortcutsSection(): HTMLElement {
  const section = document.createElement('section');
  section.className = 'help-section';
  section.setAttribute('aria-labelledby', 'help-shortcuts-title');

  const title = document.createElement('h3');
  title.id = 'help-shortcuts-title';
  title.className = 'help-section-title';
  title.textContent = 'Keyboard Shortcuts';
  section.appendChild(title);

  const note = document.createElement('p');
  note.className = 'help-section-text help-section-text--muted';
  note.textContent = 'Timestamp supports keyboard shortcuts for countdown control and navigation:';
  section.appendChild(note);

  // Group shortcuts by context
  const groups = {
    'all-modes': KEYBOARD_SHORTCUTS.filter(s => s.group === 'all-modes'),
    'timer-only': KEYBOARD_SHORTCUTS.filter(s => s.group === 'timer-only'),
    'theme-selector': KEYBOARD_SHORTCUTS.filter(s => s.group === 'theme-selector'),
  };

  const groupTitles = {
    'all-modes': 'All Modes',
    'timer-only': 'Timer Mode Only',
    'theme-selector': 'Theme Selector',
  };

  // Build tables for each group
  for (const [groupKey, shortcuts] of Object.entries(groups)) {
    if (shortcuts.length === 0) continue;

    const groupTitle = document.createElement('h4');
    groupTitle.className = 'help-shortcuts-group-title';
    groupTitle.textContent = groupTitles[groupKey as keyof typeof groupTitles];
    section.appendChild(groupTitle);

    const table = document.createElement('table');
    table.className = 'help-shortcuts-table';
    table.setAttribute('role', 'table');

    const thead = document.createElement('thead');
    thead.innerHTML = `
      <tr>
        <th scope="col">Key</th>
        <th scope="col">Action</th>
        <th scope="col">Notes</th>
      </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    for (const shortcut of shortcuts) {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td><kbd>${shortcut.key}</kbd></td>
        <td>${shortcut.action}</td>
        <td class="help-shortcuts-notes">${shortcut.notes ?? ''}</td>
      `;
      tbody.appendChild(row);
    }
    table.appendChild(tbody);

    section.appendChild(table);

    // Add note about disabled shortcuts after timer table
    if (groupKey === 'timer-only') {
      const disabledNote = document.createElement('p');
      disabledNote.className = 'help-section-text help-section-text--small';
      disabledNote.textContent = 'Timer shortcuts are disabled when typing in text fields or when a modal is open.';
      section.appendChild(disabledNote);
    }
  }

  return section;
}

/**
 * Build the Features section.
 */
function buildFeaturesSection(): HTMLElement {
  const section = document.createElement('section');
  section.className = 'help-section';
  section.setAttribute('aria-labelledby', 'help-features-title');

  const title = document.createElement('h3');
  title.id = 'help-features-title';
  title.className = 'help-section-title';
  title.textContent = 'Features';
  section.appendChild(title);

  const features: Array<{ icon: IconName; title: string; desc: string }> = [
    { icon: 'link', title: 'Instant URL Sharing', desc: 'Every configuration generates a shareable URL. Change any setting and the URL updates automatically.' },
    { icon: 'device-desktop', title: 'Install as App (PWA)', desc: 'Install Timestamp from your browser for offline support, full-screen mode, and automatic updates.' },
    { icon: 'globe', title: 'World Map', desc: 'Wall-clock mode shows a day/night map with real-time solar position. See which cities are celebrating.' },
    { icon: 'home', title: 'Accessibility', desc: 'Full keyboard navigation, screen reader support, and reduced motion options for users who need them.' },
    { icon: 'paintbrush', title: 'Multiple Themes', desc: 'Choose from beautiful themes including GitHub contribution graph style and dynamic fireworks.' },
  ];

  const featuresList = document.createElement('ul');
  featuresList.className = 'help-features-list';

  for (const feature of features) {
    const item = document.createElement('li');
    item.className = 'help-feature-item';
    item.innerHTML = `
      <span class="help-feature-icon" aria-hidden="true">${getIconSvg(feature.icon, 20)}</span>
      <div class="help-feature-content">
        <span class="help-feature-title">${feature.title}</span>
        <span class="help-feature-desc">${feature.desc}</span>
      </div>
    `;
    featuresList.appendChild(item);
  }

  section.appendChild(featuresList);
  return section;
}

/**
 * Build the FAQ section.
 */
function buildFAQSection(): HTMLElement {
  const section = document.createElement('section');
  section.className = 'help-section help-section--faq';
  section.setAttribute('aria-labelledby', 'help-faq-title');

  const title = document.createElement('h3');
  title.id = 'help-faq-title';
  title.className = 'help-section-title';
  title.textContent = 'Frequently Asked Questions';
  section.appendChild(title);

  const faqList = document.createElement('dl');
  faqList.className = 'help-faq-list';

  for (const faq of FAQ_ITEMS) {
    const questionTerm = document.createElement('dt');
    questionTerm.className = 'help-faq-question';
    questionTerm.textContent = faq.question;

    const answerDef = document.createElement('dd');
    answerDef.className = 'help-faq-answer';
    answerDef.innerHTML = faq.answer;

    faqList.appendChild(questionTerm);
    faqList.appendChild(answerDef);
  }

  section.appendChild(faqList);
  return section;
}
