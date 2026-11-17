/* Resize overlay inspectors without touching the map or rebuilding their content. */
const PANEL_SELECTOR = '#results, #detail, #spot-explorer, .future-radar, .sky-cloud-controls, #environment-key';
const DIALOG_SELECTOR = '#share-dialog, .notices-dialog';
const HEADER_SELECTOR = '.floating-head, .radar-heading, .map-key-toggle';
const instances = new WeakMap();
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

export function panelResizeBounds({height, bottom = 0, header = 44, narrow = false}) {
  const inset = clamp(Number(bottom) || 0, 0, Math.max(0, height - header));
  const min = Math.max(36, Math.ceil(header + 2));
  // User resizing can use nearly the whole viewport; keep only a small map strip.
  const mapSpace = narrow ? Math.min(56, height * .15) : 8;
  return {bottom: inset, min, max: Math.max(min, Math.floor(height - inset - mapSpace))};
}
export function panelDragHeight(startTop, pointerDelta, shellBottom, bounds) {
  return clamp(shellBottom - bounds.bottom - startTop - pointerDelta, bounds.min, bounds.max);
}

export function installPanelDrag(shell) {
  if (!shell?.ownerDocument) return null;
  if (instances.has(shell)) return instances.get(shell);
  const doc = shell.ownerDocument, win = doc.defaultView, records = new Map();
  let drag = null, frame = 0, refreshFrame = 0, suppressClick = null, suppressTimer = 0, togglingKey = false;
  const visible = node => !node.hidden && node.getClientRects().length && win.getComputedStyle(node).visibility !== 'hidden';
  const titleFor = record => record.panel.querySelector('h2')?.textContent || record.panel.getAttribute('aria-label') || 'Map';
  const metrics = record => {
    const sr = record.dialog ? {top:0,bottom:win.innerHeight,height:win.innerHeight,width:win.innerWidth} : shell.getBoundingClientRect(), pr = record.panel.getBoundingClientRect();
    let bottom = 8;
    for (const control of shell.querySelectorAll('.map-toolbar, .map-attribution')) {
      if (!visible(control)) continue;
      const r = control.getBoundingClientRect();
      if (r.top >= sr.top + sr.height * .5) bottom = Math.max(bottom, sr.bottom - r.top + 6);
    }
    return {...panelResizeBounds({height:sr.height, bottom, header:record.head.getBoundingClientRect().height,
      narrow:pr.width > sr.width * .75}), shellBottom:sr.bottom};
  };
  function toggleKey(record) {
    togglingKey = true;try {record.head.click();} finally {togglingKey = false;}
  }
  function setCollapsed(record, collapsed) {
    if (record.panel.classList.contains('panel-drag-collapsed') !== collapsed) record.panel.classList.toggle('panel-drag-collapsed', collapsed);
    // Clipped controls must not receive keyboard focus. Keep their existing inert state.
    for (const child of record.panel.children) {
      if (child === record.head) continue;
      if (collapsed) {
        if (!record.inert.has(child)) record.inert.set(child, child.inert);
        if (child.contains(doc.activeElement)) record.head.focus?.({preventScroll:true});
        child.inert = true;
      } else if (record.inert.has(child)) {
        child.inert = record.panel.id === 'environment-key' && record.panel.dataset.expanded === 'false' ? true : record.inert.get(child);record.inert.delete(child);
      }
    }
  }
  function paint(record, height, bounds, remember = true) {
    const size = clamp(height, bounds.min, bounds.max);
    if (remember && (record.panel.id !== 'environment-key' || size > bounds.min + 1)) record.height = size;
    record.panel.style.setProperty('--panel-drag-height', size + 'px');
    record.panel.style.setProperty('--panel-drag-bottom', bounds.bottom + 'px');
    if (!record.panel.classList.contains('panel-user-sized')) record.panel.classList.add('panel-user-sized');
    setCollapsed(record, size <= bounds.min + 1);
    record.head.setAttribute('aria-description', 'Drag up or down to resize. Keyboard: Up and Down arrows; Home to minimize, End to expand.');
  }
  function reset(record) {
    record.height = null;record.panel.classList.remove('panel-user-sized');setCollapsed(record, false);
  }
  function refresh(record) {
    if (!record.panel.isConnected) {records.delete(record.panel);return;}
    for (const child of record.inert.keys()) if (child.parentElement !== record.panel) record.inert.delete(child);
    let head = [...record.panel.children].find(node => node.matches(HEADER_SELECTOR));
    if (!head && record.panel.id === 'share-dialog') {
      const title = record.panel.querySelector('h2'), closeForm = [...record.panel.children].find(node => node.matches('form'));
      if (title && closeForm) {
        head = doc.createElement('div');head.classList.add('floating-head');
        record.panel.insertBefore(head, record.panel.firstChild);head.append(title,closeForm);
      }
    }
    if (!head) return;
    if (record.head !== head) {
      record.head = head;head.classList.add('panel-drag-header');
      if (!head.matches('button')) {head.tabIndex = 0;head.setAttribute('role', 'group');}
      head.setAttribute('aria-keyshortcuts', 'ArrowUp ArrowDown Home End');
      head.title = 'Drag up or down to resize';
      head.setAttribute('aria-description', 'Drag up or down to resize. Keyboard: Up and Down arrows; Home to minimize, End to expand.');
    }
    if (!head.matches('button')) head.setAttribute('aria-label', titleFor(record) + ' panel size');
    if (!visible(record.panel) || drag?.record === record) return;
    if (record.height !== null) {
      const bounds = metrics(record);
      paint(record, record.panel.id === 'environment-key' && record.panel.dataset.expanded === 'false' ? bounds.min : record.height, bounds, false);
    }
  }
  function scheduleRefresh() {
    if (!refreshFrame) refreshFrame = win.requestAnimationFrame(() => {
      refreshFrame = 0;for (const record of records.values()) refresh(record);
    });
  }
  function attach(panel) {
    if (records.has(panel)) return;
    const record = {panel, head:null, height:null, inert:new Map(), dialog:panel.matches('dialog')};records.set(panel, record);
    panel.classList.add('panel-draggable');refresh(record);
    observer.observe(panel, {childList:true, attributes:true, attributeFilter:['hidden','data-expanded','open']});
    // Native dialogs live in the browser's top layer, outside the map shell.
    // Keep their modal/focus behavior and attach only their gesture handlers.
    if (record.dialog) listen(panel, true);
  }
  const observer = new win.MutationObserver(changes => {
    for (const change of changes) if (change.target === shell || change.target === doc.body) {
      const selector = change.target === shell ? PANEL_SELECTOR : DIALOG_SELECTOR;
      for (const node of change.addedNodes) if (node.nodeType === 1 && node.matches(selector)) attach(node);
    }
    scheduleRefresh();
  });
  observer.observe(shell, {childList:true});
  observer.observe(doc.body, {childList:true});
  for (const panel of shell.querySelectorAll(PANEL_SELECTOR)) attach(panel);
  for (const panel of doc.body.querySelectorAll(DIALOG_SELECTOR)) attach(panel);
  const resize = win.ResizeObserver ? new win.ResizeObserver(scheduleRefresh) : null;
  resize?.observe(shell);
  for (const control of shell.querySelectorAll('.map-toolbar, .map-attribution')) resize?.observe(control);

  function flushDrag() {
    frame = 0;if (!drag?.active) return;
    const height = panelDragHeight(drag.top, drag.y - drag.startY, drag.bottom, drag.bounds);
    paint(drag.record, height, drag.bounds);
    drag.record.panel.scrollTop = drag.scroll;
  }
  function down(event) {
    if (drag || event.isPrimary === false || (event.button !== undefined && event.button !== 0)) return;
    const head = event.target.closest?.('.panel-drag-header');
    const record = head && records.get(head.parentElement);
    if (!record || record.head !== head || event.target.closest('input,select,textarea,[contenteditable=true]')) return;
    const box = record.panel.getBoundingClientRect(), bounds = metrics(record);
    // Capture on the original element immediately. Capturing only after movement
    // lets mobile scrolling/native button gestures cancel the stream first.
    const capture = event.target.setPointerCapture ? event.target : head;
    suppressClick = null;win.clearTimeout(suppressTimer);
    drag = {record, capture, id:event.pointerId, startY:event.clientY, y:event.clientY, top:box.top,
      bottom:bounds.shellBottom, bounds, scroll:record.panel.scrollTop, active:false,
      wasSized:record.panel.classList.contains('panel-user-sized'), expandedHeight:record.height || box.height,
      oldHeight:record.panel.style.getPropertyValue('--panel-drag-height'),
      oldBottom:record.panel.style.getPropertyValue('--panel-drag-bottom')};
    // Freeze the grabbed geometry before asynchronous listings/feeds can change
    // an auto-height panel. An ordinary tap restores the original sizing.
    record.panel.style.setProperty('--panel-drag-height', box.height + 'px');
    record.panel.style.setProperty('--panel-drag-bottom', (bounds.shellBottom - box.bottom) + 'px');
    if (!drag.wasSized) record.panel.classList.add('panel-user-sized');
    try {capture.setPointerCapture(event.pointerId);} catch {}
    if (!event.target.closest('button,a')) event.preventDefault();
    event.stopPropagation();
  }
  function move(event) {
    if (!drag || event.pointerId !== drag.id) return;
    drag.y = event.clientY;
    if (!drag.active && Math.abs(drag.y - drag.startY) < 5) return;
    if (!drag.active) {
      drag.active = true;drag.record.panel.classList.add('panel-is-dragging');
      // Map key uses a button for its entire header. A real upward drag opens it;
      // an ordinary tap still follows the original expand/collapse handler.
      if (drag.record.panel.id === 'environment-key' && drag.record.panel.dataset.expanded === 'false' && drag.y < drag.startY) toggleKey(drag.record);
    }
    event.preventDefault();event.stopPropagation();
    if (!frame) frame = win.requestAnimationFrame(flushDrag);
  }
  function finish(event) {
    if (!drag || event.pointerId !== drag.id) return;
    if (drag.active) {
      if (event.type === 'pointerup' && Number.isFinite(event.clientY)) drag.y = event.clientY;
      if (frame) {win.cancelAnimationFrame(frame);frame = 0;}flushDrag();
      drag.record.panel.classList.remove('panel-is-dragging');
      if (drag.record.panel.id === 'environment-key' && drag.record.panel.classList.contains('panel-drag-collapsed')) {
        drag.record.height = Math.max(drag.expandedHeight, drag.bounds.min + 80);
        if (drag.record.panel.dataset.expanded === 'true') toggleKey(drag.record);
      }
      // Do not manually release capture before pointerup finishes: browsers use
      // that target for the following click, including Safari's detail=0 click.
      suppressClick = drag.record.head;win.clearTimeout(suppressTimer);
      suppressTimer = win.setTimeout(() => {suppressClick = null;}, 600);
      event.preventDefault();event.stopPropagation();
    } else {
      const {record,wasSized,oldHeight,oldBottom} = drag;
      if (oldHeight) record.panel.style.setProperty('--panel-drag-height',oldHeight);else record.panel.style.removeProperty('--panel-drag-height');
      if (oldBottom) record.panel.style.setProperty('--panel-drag-bottom',oldBottom);else record.panel.style.removeProperty('--panel-drag-bottom');
      if (!wasSized) record.panel.classList.remove('panel-user-sized');
    }
    drag = null;scheduleRefresh();
  }
  function click(event) {
    if (!togglingKey && suppressClick && (event.target === suppressClick || suppressClick.contains(event.target))) {
      suppressClick = null;event.preventDefault();event.stopImmediatePropagation();return;
    }
    const control = event.target.closest?.('.detail-expand,.more-map');
    const record = control && records.get(control.closest(PANEL_SELECTOR));
    // Existing Expand/More map controls can still take over after a manual size.
    if (record) reset(record);
  }
  function key(event) {
    const record = records.get(event.target.parentElement);
    if (!record || record.head !== event.target || !['ArrowUp','ArrowDown','Home','End'].includes(event.key)) return;
    event.preventDefault();event.stopPropagation();
    if (record.panel.id === 'environment-key' && record.panel.dataset.expanded === 'false') {
      if (event.key === 'ArrowDown' || event.key === 'Home') return;
      toggleKey(record);
    }
    const bounds = metrics(record), current = record.panel.getBoundingClientRect().height;
    const amount = event.shiftKey ? 80 : 32;
    const next = event.key === 'Home' ? bounds.min : event.key === 'End' ? bounds.max : current + (event.key === 'ArrowUp' ? amount : -amount);
    paint(record, next, bounds);
    if (record.panel.id === 'environment-key' && next <= bounds.min && record.panel.dataset.expanded === 'true') toggleKey(record);
  }
  function blur() { if (drag) finish({pointerId:drag.id,preventDefault(){},stopPropagation(){}}); }
  function nativeDrag(event) { if (event.target.closest?.('.panel-drag-header')) event.preventDefault(); }
  function listen(target, enabled) {
    const method = enabled ? 'addEventListener' : 'removeEventListener';
    target[method]('pointerdown', down, enabled ? {capture:true,passive:false} : true);
    target[method]('dragstart', nativeDrag, true);
    target[method]('click', click, true);
    target[method]('keydown', key);
  }
  listen(shell, true);
  win.addEventListener('pointermove', move, {capture:true,passive:false});
  win.addEventListener('pointerup', finish, {capture:true,passive:false});
  win.addEventListener('pointercancel', finish, {capture:true,passive:false});
  win.addEventListener('lostpointercapture', finish, true);
  win.addEventListener('resize', scheduleRefresh);
  win.addEventListener('blur', blur);
  win.visualViewport?.addEventListener('resize', scheduleRefresh);
  const api = {refresh:scheduleRefresh, destroy() {
    observer.disconnect();resize?.disconnect();win.cancelAnimationFrame(frame);win.cancelAnimationFrame(refreshFrame);win.clearTimeout(suppressTimer);
    listen(shell, false);
    win.removeEventListener('pointermove', move, true);win.removeEventListener('pointerup', finish, true);win.removeEventListener('pointercancel', finish, true);win.removeEventListener('lostpointercapture', finish, true);
    win.removeEventListener('resize', scheduleRefresh);win.removeEventListener('blur', blur);win.visualViewport?.removeEventListener('resize', scheduleRefresh);
    for (const record of records.values()) {reset(record);record.panel.classList.remove('panel-draggable');if(record.dialog)listen(record.panel,false);}
    instances.delete(shell);
  }};
  instances.set(shell, api);return api;
}
