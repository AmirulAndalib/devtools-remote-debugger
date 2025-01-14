import throttle from 'lodash.throttle';
import { isMatches, isMobile, loadScript } from '../common/utils';
import { DEVTOOL_OVERLAY, HTML_TO_CANVAS_CANVAS } from '../common/constant';
import BaseDomain from './domain';
import { Event } from './protocol';
/*
import Compressor from 'compressorjs';

function captureAndCompress(element, quality) {
  html2canvas(element).then(canvas => {
    canvas.toBlob(blob => {
      if (blob) {
        compress(blob, quality).then(compressedFile => {
          // 处理压缩后的文件
          console.log('Compressed file:', compressedFile);
        }).catch(err => {
          console.error('Compression error:', err);
        });
      }
    });
  });
}

function compress(file, quality) {
  return new Promise((resolve, reject) => {
    new Compressor(file, {
      quality,
      success(result) {
        if (result instanceof Blob) {
          // 为了保持一致性，转为File对象
          resolve(new window.File([result], file.name, { type: file.type }));
        } else {
          resolve(result);
        }
        // downloadFile(result, file.name);
      },
      error(err) {
        reject(err);
      },
    });
  });
}
*/

const DOM_TO_IMAGE = 'https://unpkg.com/dom-to-image@2.6.0/dist/dom-to-image.min.js';
const HTML_TO_IMAGE = 'https://unpkg.com/html2canvas@1.4.1/dist/html2canvas.min.js';

let useDomToImage = true;
export default class ScreenPreview extends BaseDomain {
  namespace = 'ScreenPreview';

  static elementExclude(element) {
    if (!element || element.tagName === 'SCRIPT') return true;
    if (!element?.style) return false;
    const { display, opacity, visibility } = element.style;
    return isMatches(element, `.${DEVTOOL_OVERLAY}`) ||
      display === 'none' ||
      opacity === 0 ||
      visibility === 'hidden';
  }

  static captureScreen = throttle(() => {
    // Faster and less dom contamination
    if (useDomToImage) {
      const renderScreen = () => {
        return window.domtoimage.toJpeg(document.body, {
          quality: 0.6,
          filter: (ele) => !ScreenPreview.elementExclude(ele)
        }).catch(e => {
          console.error('Failed to capture screen with dom-to-image:', e);
          useDomToImage = false;
        });
      }
      if (window.domtoimage) {
        return renderScreen();
      }
  
      return loadScript(DOM_TO_IMAGE).then(renderScreen);
    } else {
      const canvas = document.createElement('canvas');
      canvas.className = HTML_TO_CANVAS_CANVAS;
      const renderScreen = () => window.html2canvas(document.body, {
        allowTaint: true,
        backgroundColor: null,
        useCORS: true,
        imageTimeout: 10000,
        scale: 1,
        logging: false,
        foreignObjectRendering: false,
        ignoreElements: ScreenPreview.elementExclude
      }).then(canvas => canvas.toDataURL('image/jpeg'));
  
      if (window.html2canvas) {
        return renderScreen();
      }
  
      return loadScript(HTML_TO_IMAGE).then(renderScreen);
    }
  }, 300)

  /**
   * Start live preview
   * @public
   */
  startPreview() {
    const selector = 'link[rel="stylesheet"],style';
    const styles = document.querySelectorAll(selector);
    let counts = styles.length;

    const joinStyleTags = (styles) => {
      let tags = '';
      Array.from(styles).forEach(style => {
        const tag = style.tagName.toLowerCase();

        if (tag === 'link') {
          tags += `<link href="${style.href}" rel="stylesheet">`;
        }

        if (tag === 'style') {
          tags += `<style>${style.innerHTML}</style>`;
        }
      });
      return `<head>${tags}</head>`;
    };

    this.send({
      method: Event.captured,
      params: {
        isMobile: isMobile(),
        head: joinStyleTags(styles),
        body: document.body.innerHTML,
        width: window.innerWidth,
        height: window.innerHeight,
      }
    });

    // Observe the changes of the document
    this.observerInst = new MutationObserver(throttle(() => {
      const curStyles = document.querySelectorAll(selector);
      let head;
      if (curStyles.length !== counts) {
        counts = curStyles.length;
        head = joinStyleTags(curStyles);
      }

      this.send({
        method: Event.captured,
        params: {
          head,
          body: document.body.innerHTML,
          width: window.innerWidth,
          height: window.innerHeight,
          isMobile: isMobile(),
        }
      });
    }, 350));

    this.observerInst.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });

    window.addEventListener('scroll', this.syncScroll);

    ['mousemove', 'mousedown', 'mouseup', 'touchmove', 'touchstart', 'touchend'].forEach(event => {
      window.addEventListener(event, this.syncMouse);
    });
  }

  /**
   * stop live preview
   * @public
   */
  stopPreview() {
    this.observerInst && this.observerInst.disconnect();
    window.removeEventListener('scroll', this.syncScroll);
    ['mousemove', 'mousedown', 'mouseup', 'touchmove', 'touchstart', 'touchend'].forEach(event => {
      window.removeEventListener(event, this.syncMouse);
    });
  }

  syncScroll = throttle(() => {
    const scrollTop = document.body.scrollTop || document.documentElement.scrollTop;
    const scrollLeft = document.body.scrollLeft || document.documentElement.scrollLeft;
    this.send({
      method: Event.syncScroll,
      params: {
        scrollTop,
        scrollLeft,
      },
    });
  }, 100);

  syncMouse = throttle((e) => {
    const type = e.type || 'mousemove';
    let left = e.clientX;
    let top = e.clientY;

    if (type.includes('touch')) {
      left = (e.touches[0] || e.changedTouches[0]).clientX;
      top = (e.touches[0] || e.changedTouches[0]).clientY;
    }

    this.send({
      method: Event.syncMouse,
      params: { type, left, top },
    });
  }, 50);
}
