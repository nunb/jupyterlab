// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  Menu
} from '@phosphor/widgets';

import {
  JupyterLab, JupyterLabPlugin
} from '@jupyterlab/application';

import {
  ICommandPalette, IMainMenu
} from '@jupyterlab/apputils';

import {
  IEditorServices
} from '@jupyterlab/codeeditor';

import {
  editorServices, CodeMirrorEditor
} from '@jupyterlab/codemirror';

import {
  ISettingRegistry, IStateDB
} from '@jupyterlab/coreutils';

import {
  IEditorTracker
} from '@jupyterlab/fileeditor';


/**
 * The command IDs used by the codemirror plugin.
 */
namespace CommandIDs {
  export
  const matchBrackets = 'codemirror:match-brackets';

  export
  const changeKeyMap = 'codemirror:change-keymap';

  export
  const changeTheme = 'codemirror:change-theme';
};


/**
 * The editor services.
 */
export
const servicesPlugin: JupyterLabPlugin<IEditorServices> = {
  id: IEditorServices.name,
  provides: IEditorServices,
  activate: (): IEditorServices => editorServices
};


/**
 * The editor commands.
 */
export
const commandsPlugin: JupyterLabPlugin<void> = {
  id: 'jupyter.services.codemirror-commands',
  requires: [IEditorTracker, IMainMenu, ICommandPalette, IStateDB, ISettingRegistry],
  activate: activateEditorCommands,
  autoStart: true
};


/**
 * Export the plugins as default.
 */
const plugins: JupyterLabPlugin<any>[] = [commandsPlugin, servicesPlugin];
export default plugins;


/**
 * Set up the editor widget menu and commands.
 */
function activateEditorCommands(app: JupyterLab, tracker: IEditorTracker, mainMenu: IMainMenu, palette: ICommandPalette, state: IStateDB, settingRegistry: ISettingRegistry): void {
  const { commands, restored } = app;
  const { id } = commandsPlugin;
  let theme: string = CodeMirrorEditor.DEFAULT_THEME;
  let keyMap: string = 'default';
  let matchBrackets = false;

  // Annotate the plugin settings.
  settingRegistry.annotate(id, '', {
    iconClass: 'jp-ImageTextEditor',
    iconLabel: 'CodeMirror',
    label: 'CodeMirror'
  });
  settingRegistry.annotate(id, 'keyMap', { label: 'Key Map' });
  settingRegistry.annotate(id, 'matchBrackets', { label: 'Match Brackets' });
  settingRegistry.annotate(id, 'theme', { label: 'Theme' });

  /**
   * Update the setting values.
   */
  function updateSettings(settings: ISettingRegistry.ISettings): void {
    const cached = settings.get('matchBrackets') as boolean | null;
    matchBrackets = cached === null ? false : !!cached;
    keyMap = settings.get('keyMap') as string | null || keyMap;
    theme = settings.get('theme') as string | null || theme;
  }

  /**
   * Update the settings of the current tracker instances.
   */
  function updateTracker(): void {
    tracker.forEach(widget => {
      if (widget.editor instanceof CodeMirrorEditor) {
        let cm = widget.editor.editor;
        cm.setOption('keyMap', keyMap);
        cm.setOption('theme', theme);
        cm.setOption('matchBrackets', matchBrackets);
      }
    });
  }

  // Fetch the initial state of the settings.
  Promise.all([settingRegistry.load(id), restored]).then(([settings]) => {
    updateSettings(settings);
    updateTracker();
    settings.changed.connect(() => {
      updateSettings(settings);
      updateTracker();
    });
  });

  /**
   * Handle the settings of new widgets.
   */
  tracker.widgetAdded.connect((sender, widget) => {
    if (widget.editor instanceof CodeMirrorEditor) {
      let cm = widget.editor.editor;
      cm.setOption('keyMap', keyMap);
      cm.setOption('theme', theme);
      cm.setOption('matchBrackets', matchBrackets);
    }
  });

  // Update the command registry when the codemirror state changes.
  tracker.currentChanged.connect(() => {
    if (tracker.size <= 1) {
      commands.notifyCommandChanged(CommandIDs.matchBrackets);
    }
  });

  /**
   * A test for whether the tracker has an active widget.
   */
  function hasWidget(): boolean {
    return tracker.currentWidget !== null;
  }

  /**
   * Create a menu for the editor.
   */
  function createMenu(): Menu {
    const menu = new Menu({ commands });
    const themeMenu = new Menu({ commands });
    const keyMapMenu = new Menu({ commands });

    menu.title.label = 'Editor';
    themeMenu.title.label = 'Theme';
    keyMapMenu.title.label = 'Key Map';

    commands.addCommand(CommandIDs.changeTheme, {
      label: args => args['theme'] as string,
      execute: args => {
        theme = args['theme'] as string || CodeMirrorEditor.DEFAULT_THEME;
        tracker.forEach(widget => {
          if (widget.editor instanceof CodeMirrorEditor) {
            let cm = widget.editor.editor;
            cm.setOption('theme', theme);
          }
        });
        return settingRegistry.set(id, 'theme', theme);
      },
      isEnabled: hasWidget,
      isToggled: args => args['theme'] === theme
    });

    commands.addCommand(CommandIDs.changeKeyMap, {
      label: args => {
        let title = args['keyMap'] as string;
        return title === 'sublime' ? 'Sublime Text' : title;
      },
      execute: args => {
        keyMap = args['keyMap'] as string || 'default';
        tracker.forEach(widget => {
          if (widget.editor instanceof CodeMirrorEditor) {
            let cm = widget.editor.editor;
            cm.setOption('keyMap', keyMap);
          }
        });
        return settingRegistry.set(id, 'keyMap', keyMap);
      },
      isEnabled: hasWidget,
      isToggled: args => args['keyMap'] === keyMap
    });

    [
     'jupyter', 'default', 'abcdef', 'base16-dark', 'base16-light',
     'hopscotch', 'material', 'mbo', 'mdn-like', 'seti', 'the-matrix',
     'xq-light', 'zenburn'
    ].forEach(name => themeMenu.addItem({
      command: CommandIDs.changeTheme,
      args: { theme: name }
    }));

    ['default', 'sublime', 'vim', 'emacs'].forEach(name => {
      keyMapMenu.addItem({
        command: CommandIDs.changeKeyMap,
        args: { keyMap: name }
      });
    });

    menu.addItem({ command: 'editor:line-numbers' });
    menu.addItem({ command: 'editor:word-wrap' });
    menu.addItem({ command: CommandIDs.matchBrackets });
    menu.addItem({ type: 'separator' });
    menu.addItem({ type: 'submenu', submenu: keyMapMenu });
    menu.addItem({ type: 'submenu', submenu: themeMenu });

    return menu;
  }

  mainMenu.addMenu(createMenu(), { rank: 30 });

  commands.addCommand(CommandIDs.matchBrackets, {
    execute: () => {
      matchBrackets = !matchBrackets;
      tracker.forEach(widget => {
        const editor = widget.editor;
        if (editor instanceof CodeMirrorEditor) {
          const cm = editor.editor;
          cm.setOption('matchBrackets', matchBrackets);
        }
      });
      return settingRegistry.set(id, 'matchBrackets', matchBrackets);
    },
    label: 'Match Brackets',
    isEnabled: hasWidget,
    isToggled: () => matchBrackets
  });

  [
    'editor:line-numbers',
    'editor:line-wrap',
    CommandIDs.matchBrackets,
    'editor:create-console',
    'editor:run-code'
  ].forEach(command => palette.addItem({ command, category: 'Editor' }));

}
