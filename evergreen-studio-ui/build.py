#!/usr/bin/env python3
"""Assemble reference/index.html (links ../tokens.css, ../components.css) and artifact.html (self-contained)."""
import pathlib
root = pathlib.Path(__file__).parent
screens_order = [
  ("research","Research","g r"),("advice","Advice","g a"),("plan","Plan","g p"),("facts","Facts","g f"),
  ("writer","Writer","g w"),("subtitles","Subtitles","g s"),("database","Database","g d"),("videos","My Videos","g m"),
]
screens = "\n".join((root/"reference"/"screens"/f"{k}.html").read_text() for k,_,_ in screens_order)
tabs = "\n".join(
  f'      <a class="tab{" is-active" if i==0 else ""}" role="tab" tabindex="0" data-screen="{k}" data-key="{key}">{label}</a>'
  for i,(k,label,key) in enumerate(screens_order))
app = f'''<div class="app" id="app">
  <nav class="topnav" aria-label="Primary">
    <a class="brand" href="#research">evergreen/studio</a>
    <div class="tabs" role="tablist">
{tabs}
    </div>
    <div class="nav-right">
      <button class="kbtn" type="button">Jump · ⌘K</button>
      <button class="projsel" type="button">Project: Small towns ▾</button>
    </div>
  </nav>
  <main class="main">
{screens}
  </main>
  <footer class="statusbar">
    <span><span class="dot">●</span> API connected</span>
    <span>BullMQ: 1 running · 1 queued</span>
    <span>YouTube quota 6,420 / 10,000</span>
    <span>LLM spend today $0.84</span>
    <span>Postgres: 14,382 videos</span>
  </footer>
</div>'''
js = '''(function(){
  var tabs=[].slice.call(document.querySelectorAll(".tab"));
  var screens=[].slice.call(document.querySelectorAll(".screen"));
  function show(id){
    if(!document.getElementById("screen-"+id))id="research";
    screens.forEach(function(s){s.hidden=s.getAttribute("data-screen")!==id;});
    tabs.forEach(function(t){var on=t.getAttribute("data-screen")===id;t.classList.toggle("is-active",on);t.setAttribute("aria-selected",on);});
    try{history.replaceState(null,"","#"+id);}catch(e){}
  }
  tabs.forEach(function(t){
    t.addEventListener("click",function(){show(t.getAttribute("data-screen"));});
    t.addEventListener("keydown",function(e){if(e.key==="Enter"||e.key===" "){e.preventDefault();show(t.getAttribute("data-screen"));}});
  });
  show((location.hash||"#research").slice(1));
})();'''
# reference/index.html
ref = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Evergreen Studio reference</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap">
<link rel="stylesheet" href="../tokens.css">
<link rel="stylesheet" href="../components.css">
<style>html,body{{height:100%;margin:0;background:var(--bg)}}</style>
</head>
<body>
{app}
<script>{js}</script>
</body>
</html>
'''
(root/"reference"/"index.html").write_text(ref)

# artifact.html (self-contained, with a small page header and width toggle)
tokens=(root/"tokens.css").read_text(); comps=(root/"components.css").read_text()
art=f'''<title>Evergreen Studio</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap">
<style>
{tokens}
{comps}
body{{background:var(--bg);color:var(--fg);font-family:var(--f-ui);padding-inline:16px;padding-block:16px 32px}}
.page{{max-width:1500px;margin:0 auto;display:flex;flex-direction:column;gap:12px}}
.page-bar{{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}}
.page-bar p{{margin:0;color:var(--mute);font-size:12.5px;max-width:70ch}}
.page-bar .tools{{display:flex;gap:8px;flex-wrap:wrap}}
.frame{{overflow-x:auto;border:1px solid var(--line);border-radius:6px}}
.frame .app{{height:auto;min-height:660px;width:var(--w,100%)}}
.frame .main{{overflow:visible}}
</style>
<div class="page">
  <div class="page-bar">
    <p>Console direction with top navigation. All eight tabs are clickable. Data is sample data.</p>
    <div class="tools">
      <div class="seg" id="w"><span data-w="1100px">1100</span><span data-w="1440px">1440</span><span class="is-on" data-w="100%">Fit</span></div>
      <button class="btn" id="theme" type="button">Theme: auto</button>
    </div>
  </div>
  <div class="frame" id="frame">
{app}
  </div>
</div>
<script>{js}
(function(){{
  var f=document.getElementById("frame");
  document.getElementById("w").addEventListener("click",function(e){{var s=e.target.closest("[data-w]");if(!s)return;
    [].forEach.call(this.children,function(c){{c.classList.toggle("is-on",c===s);}});
    f.querySelector(".app").style.setProperty("--w",s.getAttribute("data-w"));}});
  var modes=["auto","light","dark"],i=0,b=document.getElementById("theme");
  b.addEventListener("click",function(){{i=(i+1)%3;var m=modes[i],r=document.documentElement;
    if(m==="auto")r.removeAttribute("data-theme");else r.setAttribute("data-theme",m);b.textContent="Theme: "+m;}});
}})();
</script>
'''
(root/"artifact.html").write_text(art)
print("built")
