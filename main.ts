import {
  App,
  MarkdownRenderer,
  MarkdownView,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
} from "obsidian";
import { clipboard } from "electron";

export default class TipsyExportPlugin extends Plugin {
  settings: TipsyExportPluginSettings;

  async onload() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    this.addSettingTab(new TipsyExportPluginSettingTab(this.app, this));

    this.addCommand({
      id: "tipsy-export-html",
      name: "Export Note as HTML",
      callback: () => this.copyAsHtml(),
    });

    this.addCommand({
      id: "tipsy-export-rich-text",
      name: "Export Note as Rich Text",
      callback: () => this.copyAsRichText(),
    });
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  private async copyAsHtml() {
    await this.copy("HTML", clipboard.writeText);
  }

  private async copyAsRichText() {
    await this.copy("Rich Text", clipboard.writeHTML);
  }

  private async copy(label: string, copy: (html: string) => void) {
    const file = this.app.workspace.getActiveFile();
    if (!file) {
      return void new Notice("No active file");
    }

    const markdown = await this.app.vault.adapter.read(file.path);
    const html = await this.render(file.path, markdown);
    if (!html) {
      return;
    }

    copy(html);
    new Notice(`Exported ${label} (${html.length} characters) copied`);
  }

  private async render(path: string, markdown: string) {
    const leaf = this.app.workspace.getMostRecentLeaf();
    if (!leaf) {
      return void new Notice("No leaf to render");
    }

    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView) ??
      new MarkdownView(leaf);

    const wrapper = document.createElement("div");
    wrapper.style.display = "none";
    document.body.appendChild(wrapper);

    await MarkdownRenderer.render(
      this.app,
      markdown,
      wrapper,
      path,
      activeView,
    );

    this.adjustRenderedHtml(wrapper);
    const html = wrapper.innerHTML.trim();

    document.body.removeChild(wrapper);

    return html;
  }

  private adjustRenderedHtml(wrapper: HTMLDivElement) {
    // 1. Detatch frontmatter.
    wrapper.find(".frontmatter")?.detach();

    // <p><br></p><p align="center">──── ❁ ────</p><p><br></p>
    // 2. Replace divider if custom variant exists.
    if (this.settings.divider) {
      for (const hr of wrapper.findAll("hr")) {
        hr.outerHTML = this.settings.divider;
      }
    }
  }
}

interface TipsyExportPluginSettings {
  divider: string;
}

const DEFAULT_SETTINGS: TipsyExportPluginSettings = {
  divider: "",
};

class TipsyExportPluginSettingTab extends PluginSettingTab {
  constructor(app: App, readonly plugin: TipsyExportPlugin) {
    super(app, plugin);
  }

  display() {
    this.containerEl.empty();

    new Setting(this.containerEl)
      .setName("Custom Divider")
      .setDesc("Will replace hr tags if set.")
      .addText((text) => {
        text
          .setValue(this.plugin.settings.divider)
          .onChange(async (value) => {
            this.plugin.settings.divider = value;
            await this.plugin.saveSettings();
          });
      });
  }
}
