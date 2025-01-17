import BaseDomain from './domain';
import { getAbsolutePath } from '../common/utils';
import { Event } from './protocol';

export default class Debugger extends BaseDomain {
  namespace = 'Debugger';

  // collection of javascript scripts
  scripts = new Map(); // { id: { url, content } }

  // Unique id for javascript scripts
  scriptId = 0;

  /**
   * @public
   */
  enable() {
    const scripts = this.collectScripts();
    scripts.forEach(({ scriptId, url }) => {
      this.send({
        method: Event.scriptParsed,
        params: {
          scriptId,
          startColumn: 0,
          startLine: 0,
          endColumn: 999999,
          endLine: 999999,
          scriptLanguage: 'JavaScript',
          url,
        }
      });
    });
  }

  /**
   * Get the content of the js script file
   * @public
   * @param {Object} param
   * @param {Number} param.scriptId
   */
  getScriptSource({ scriptId }) {
    return {
      scriptSource: this.getScriptSourceById(scriptId)
    };
  }

  setScriptSource ({ scriptId, scriptSource }) {
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        action: 'cdp_override_add',
        url: this.scripts.get(scriptId).url,
        content: scriptSource,
        contentType: ''
      })
    } else {
      console.wran('Script source overrides need to be registered cdp_overrides.js (Worker Service)')
    }
  }

  /**
   * fetch the source content of the dynamic script file
   * @public
   * @param {string} url script file url address
   */
  getDynamicScript(url) {
    const scriptId = this.getScriptId();
    this.fetchScriptSource(scriptId, getAbsolutePath(url));
    this.send({
      method: Event.scriptParsed,
      params: {
        url,
        scriptId,
        startColumn: 0,
        startLine: 0,
        endColumn: 999999,
        endLine: 999999,
        scriptLanguage: 'JavaScript',
      }
    });
  }

  /**
   * Collect all scripts of the page
   * @private
   */
  collectScripts() {
    const scriptElements = document.querySelectorAll('script');
    const ret = [];
    scriptElements.forEach((script) => {
      // Avoid getting script source code repeatedly when socket reconnects
      if (script.scriptId) {
        return;
      }
      const scriptId = this.getScriptId();
      script.scriptId = scriptId;
      const src = script.getAttribute('src');
      if (src) {
        const url = getAbsolutePath(src);
        ret.push({ scriptId, url });
        this.fetchScriptSource(scriptId, url);
      }
    });
    return ret;
  }

  /**
   * Fetch javascript file source content
   * @private
   * @param {Number} scriptId javascript script unique id
   * @param {String} url javascript file url
   */
  fetchScriptSource(scriptId, url) {
    const xhr = new XMLHttpRequest();
    xhr.$$requestType = 'Script';
    xhr.__initiator = null;
    xhr.onload = () => {
      this.scripts.set(scriptId, {
        url,
        content: xhr.responseText
      });
    };
    xhr.onerror = () => {
      this.scripts.set(scriptId, {
        url,
        content: 'Cannot get script source code'
      });
    };

    xhr.open('GET', url);
    xhr.send();
  }

  /**
   * Get javascript content
   * @private
   * @param {Object} param
   * @param {Number} param.scriptId javascript script unique id
   */
  getScriptSourceById(scriptId) {
    return this.scripts.get(scriptId).content;
  }

  /**
   * Get unique id of javascript script
   * @private
   */
  getScriptId() {
    this.scriptId += 1;
    return `${this.scriptId}`;
  }
};
