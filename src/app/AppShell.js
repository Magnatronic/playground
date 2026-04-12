import { Application } from 'pixi.js';
import { InputManager } from '../input/InputManager.js';
import { SwitchManager } from '../switches/SwitchManager.js';
import { audioManager } from '../audio/AudioManager.js';
import { appState } from './AppState.js';
import { activityRegistry, getActivityById } from './ActivityRegistry.js';
import { HomeScreen } from '../ui/HomeScreen.js';
import { ActivityHeader } from '../ui/ActivityHeader.js';
import { SettingsPanel } from '../ui/SettingsPanel.js';
import '../ui/styles.css';

const STATES = { HOME: 'HOME', ACTIVITY: 'ACTIVITY', SETTINGS: 'SETTINGS' };

export class AppShell {
  constructor() {
    this.pixiApp = null;
    this.inputManager = null;
    this.switchManager = null;
    this.state = STATES.HOME;
    this.currentActivity = null;
    this.currentActivityId = null;

    // UI screens
    this.homeScreen = null;
    this.activityHeader = null;
    this.settingsPanel = null;

    this._unsubscribers = [];
    this._handleKeydown = this._handleKeydown.bind(this);
  }

  async init() {
    // Init PixiJS
    this.pixiApp = new Application();
    await this.pixiApp.init({
      background: '#1a1a2e',
      resizeTo: window,
      preference: 'webgl',
      webgl: { powerPreference: 'default' },
    });
    document.getElementById('app').appendChild(this.pixiApp.canvas);

    // Core systems
    this.inputManager = new InputManager();
    this.switchManager = new SwitchManager();

    // Populate AppState with switch profiles
    const profiles = this.switchManager.getAllProfiles();
    appState.set('switchProfiles', profiles);

    // Subscribe to AppState changes that affect core systems
    this._unsubscribers.push(
      appState.subscribe('muted', (muted) => {
        if (audioManager.isMuted() !== muted) {
          audioManager.toggleMute();
        }
      })
    );

    this._unsubscribers.push(
      appState.subscribe('switchProfiles', (profiles) => {
        profiles.forEach((p) => {
          this.switchManager.updateProfile(p.key, {
            colour: p.colour,
            impactMultiplier: p.impactMultiplier,
          });
        });
      })
    );

    // Listen for action dispatches (clear canvas, etc.)
    this._unsubscribers.push(
      appState.subscribe('_action', (action) => {
        if (action === 'clear' && this.currentActivity?.clear) {
          this.currentActivity.clear();
        }
        if (action === 'resetDefaults') {
          appState.reset();
          // Repopulate switch profiles from SwitchManager defaults
          this.switchManager.resetProfiles();
          const profiles = this.switchManager.getAllProfiles();
          appState.set('switchProfiles', profiles);
          // Refresh home screen switch UI
          this.homeScreen.refreshSwitches();
        }
        // Reset the action so it can fire again
        appState.set('_action', null);
      })
    );

    // Mount UI screens
    const overlay = document.getElementById('ui-overlay');

    this.homeScreen = new HomeScreen({
      onActivitySelected: (id) => this._launchActivity(id),
    });
    this.homeScreen.mount(overlay);

    this.activityHeader = new ActivityHeader({
      onHomeClick: () => this._goHome(),
      onSettingsClick: () => this._openSettings(),
    });
    this.activityHeader.mount(overlay);
    this.activityHeader.hide();

    this.settingsPanel = new SettingsPanel({
      onClose: () => this._closeSettings(),
    });
    this.settingsPanel.mount(overlay);

    // Global keyboard shortcuts
    window.addEventListener('keydown', this._handleKeydown);

    // Frame loop
    this.pixiApp.ticker.add((ticker) => {
      this.inputManager.update();
      if (this.currentActivity) {
        this.currentActivity.update(ticker.deltaTime);
      }
    });

    // Check for URL deep-link
    const params = new URLSearchParams(window.location.search);
    const requestedActivity = params.get('activity');
    if (requestedActivity && getActivityById(requestedActivity)) {
      this._launchActivity(requestedActivity);
    } else {
      this._transitionTo(STATES.HOME);
    }

    console.log('Playground ready');
  }

  _handleKeydown(event) {
    // Ctrl+R — clear canvas
    if (event.code === 'KeyR' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      if (this.currentActivity?.clear) {
        this.currentActivity.clear();
      }
      return;
    }

    // Ctrl+M — mute toggle
    if (event.code === 'KeyM' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      const muted = audioManager.toggleMute();
      appState.set('muted', muted);
      console.log(`Sound: ${muted ? 'muted' : 'unmuted'}`);
      return;
    }

    // Escape — toggle settings / close overlay
    if (event.code === 'Escape') {
      if (this.state === STATES.SETTINGS) {
        this._closeSettings();
      } else if (this.state === STATES.ACTIVITY) {
        this._openSettings();
      }
      return;
    }
  }

  _transitionTo(newState) {
    this.state = newState;

    switch (newState) {
      case STATES.HOME:
        this.homeScreen.show();
        this.activityHeader.hide();
        this.settingsPanel.close();
        this.inputManager.disable();
        // Hide canvas content
        if (this.pixiApp?.stage) {
          this.pixiApp.stage.visible = false;
        }
        break;

      case STATES.ACTIVITY:
        this.homeScreen.hide();
        this.activityHeader.show();
        this.settingsPanel.close();
        this.inputManager.enable();
        if (this.pixiApp?.stage) {
          this.pixiApp.stage.visible = true;
        }
        break;

      case STATES.SETTINGS:
        this.homeScreen.hide();
        this.activityHeader.show();
        this.inputManager.disable();
        if (this.currentActivityId) {
          const meta = getActivityById(this.currentActivityId);
          if (meta) {
            this.settingsPanel.open(meta.settingsSections);
          }
        }
        break;
    }
  }

  _launchActivity(id) {
    const meta = getActivityById(id);
    if (!meta) {
      console.warn(`Unknown activity: ${id}`);
      return;
    }

    // Destroy current activity
    if (this.currentActivity) {
      this.currentActivity.destroy();
      this.currentActivity = null;
      // Clear stage children
      while (this.pixiApp.stage.children.length > 0) {
        this.pixiApp.stage.removeChildAt(0);
      }
    }

    // Create new activity
    const activity = new meta.ActivityClass();
    activity.init(this.pixiApp);

    // Wire AppState subscriptions for this activity
    this._wireActivityState(activity, id);

    // Wire input
    this.inputManager.onKeyAction = (code, actionType) => {
      const profile = this.switchManager.getProfile(code);
      if (profile) {
        activity.handleInput(profile, actionType);
      }
    };

    this.currentActivity = activity;
    this.currentActivityId = id;

    // Update header
    this.activityHeader.setTitle(meta.name);

    this._transitionTo(STATES.ACTIVITY);
    console.log(`Launched activity: ${meta.name}`);
  }

  _wireActivityState(activity, activityId) {
    this._unsubActivityState();
    const subs = [];

    // Position mode — all activities
    if (activity.setMode) {
      subs.push(appState.subscribe('positionMode', (v) => {
        activity.setMode(v);
        // Apply current sweep settings when entering sweep mode
        if (v === 'sweep' && activity.currentMode) {
          if (activity.currentMode.setSpeed) activity.currentMode.setSpeed(appState.get('sweepSpeed'));
          if (activity.currentMode.setPattern) activity.currentMode.setPattern(appState.get('sweepPattern'));
        }
      }));
    }

    // Sweep settings — need to apply when sweep mode is active
    subs.push(appState.subscribe('sweepSpeed', (v) => {
      if (activity.currentMode?.setSpeed) activity.currentMode.setSpeed(v);
    }));
    subs.push(appState.subscribe('sweepPattern', (v) => {
      if (activity.currentMode?.setPattern) activity.currentMode.setPattern(v);
    }));

    // Painting-specific
    if (activityId === 'painting') {
      if (activity.setEffectType) {
        subs.push(appState.subscribe('effectType', (v) => activity.setEffectType(v)));
      }
      if (activity.setBlendMode) {
        subs.push(appState.subscribe('blendMode', (v) => activity.setBlendMode(v)));
      }
      // Effect settings — stored on the activity for use in handleInput
      subs.push(appState.subscribe('effectSize', (v) => { activity._effectSize = v; }));
      subs.push(appState.subscribe('effectOpacity', (v) => { activity._effectOpacity = v; }));
      subs.push(appState.subscribe('effectScatter', (v) => { activity._effectScatter = v; }));
    }

    // Screen Fill-specific
    if (activityId === 'screen-fill') {
      if (activity.setFillMode) {
        subs.push(appState.subscribe('fillMode', (v) => {
          activity.clear();
          activity.setFillMode(v);
        }));
      }
      // Fill mode sub-options
      subs.push(appState.subscribe('stampSize', (v) => {
        if (activity.fillMode?.setStampSize) activity.fillMode.setStampSize(v);
      }));
      subs.push(appState.subscribe('tileSize', (v) => {
        if (activity.fillMode?.setTileSize) {
          activity.fillMode.setTileSize(v);
          activity.reInitPositionMode?.();
        }
      }));
      subs.push(appState.subscribe('tilePattern', (v) => {
        if (activity.fillMode?.setPattern) {
          activity.fillMode.setPattern(v);
          activity.reInitPositionMode?.();
        }
      }));
      subs.push(appState.subscribe('shapeAssignment', (v) => {
        if (activity.fillMode?.setShapeAssignment) activity.fillMode.setShapeAssignment(v);
      }));
      subs.push(appState.subscribe('globalStampShape', (v) => {
        if (activity.fillMode?.setCurrentShape) activity.fillMode.setCurrentShape(v);
      }));
    }

    this._activitySubs = subs;
  }

  _unsubActivityState() {
    if (this._activitySubs) {
      this._activitySubs.forEach((unsub) => unsub());
      this._activitySubs = [];
    }
  }

  _goHome() {
    // Destroy current activity
    if (this.currentActivity) {
      this.currentActivity.destroy();
      this.currentActivity = null;
      this.currentActivityId = null;
      while (this.pixiApp.stage.children.length > 0) {
        this.pixiApp.stage.removeChildAt(0);
      }
    }
    this._unsubActivityState();
    this._transitionTo(STATES.HOME);
  }

  _openSettings() {
    this._transitionTo(STATES.SETTINGS);
  }

  _closeSettings() {
    this._transitionTo(STATES.ACTIVITY);
  }
}
