/* Overflow checker. Paste into DevTools on reference/index.html, or load with Playwright.
   Returns a list of problems for the CURRENTLY VISIBLE screen. Empty list = pass.
   Rules checked:
   1. No element spills outside its own box (scrollWidth > clientWidth with overflow:visible).
   2. No element sticks out past its nearest .panel / .table-scroll / .main ancestor.
   3. .table-scroll may scroll horizontally only when it holds a .tbl-min table.
   4. The page itself never scrolls horizontally. */
window.__checkOverflow = function () {
  var problems = [];
  var screen = document.querySelector('.screen:not([hidden])');
  var name = screen ? screen.getAttribute('data-screen') : '?';
  function label(el) {
    var s = el.tagName.toLowerCase();
    if (el.className && typeof el.className === 'string') s += '.' + el.className.trim().split(/\s+/).join('.');
    var t = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    return s + (t ? ' "' + t + '"' : '');
  }
  function push(kind, el, extra) { problems.push(name + ' | ' + kind + ' | ' + label(el) + (extra ? ' | ' + extra : '')); }
  if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 1) {
    problems.push(name + ' | page scrolls horizontally | ' + document.documentElement.scrollWidth + ' > ' + document.documentElement.clientWidth);
  }
  if (!screen) return problems;
  var all = [screen].concat([].slice.call(screen.querySelectorAll('*')));
  all.forEach(function (el) {
    var cs = getComputedStyle(el);
    if (cs.display === 'none' || el.tagName === 'COL' || el.tagName === 'COLGROUP') return;
    var r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return;
    // rule 1
    if (el.scrollWidth > el.clientWidth + 1 && cs.overflowX === 'visible' && el.clientWidth > 0) {
      push('content spills out of its box', el, el.scrollWidth + ' > ' + el.clientWidth);
    }
    // rule 3
    if (el.classList.contains('table-scroll') && el.scrollWidth > el.clientWidth + 1 && !el.querySelector('.tbl-min')) {
      push('table scrolls but is not a wide data table', el, el.scrollWidth + ' > ' + el.clientWidth);
    }
    // rule 2
    var box = el.parentElement && el.parentElement.closest('.panel, .table-scroll, .main');
    if (box) {
      var b = box.getBoundingClientRect();
      var inScroller = el.closest('.table-scroll') && el.closest('.table-scroll').querySelector('.tbl-min');
      if (!inScroller && (r.right > b.right + 1 || r.left < b.left - 1)) {
        push('sticks out of ' + box.className.split(' ')[0], el, 'el ' + Math.round(r.left) + '-' + Math.round(r.right) + ' box ' + Math.round(b.left) + '-' + Math.round(b.right));
      }
    }
  });
  return problems;
};
