// hud.js — every 2D overlay: money, rank, wanted stars, health, ammo,
// objective, minimap, messages, banners, and the menu screens.
import { rankFor } from './missions.js';

const $ = (id) => document.getElementById(id);

export class HUD {
  constructor(G) {
    this.G = G;
    this.map = $('minimap').getContext('2d');
    this.msgEls = [];
    this.bannerT = 0;
    this.hitT = 0;
  }

  money() { $('money').textContent = '$' + Math.floor(this.G.money).toLocaleString('en-US'); }
  rank() { $('rank').textContent = rankFor(this.G.missionsDone); }

  update(dt) {
    const G = this.G;
    this.money();
    this.rank();
    // wanted stars
    let stars = '';
    for (let i = 0; i < 5; i++) stars += i < G.wanted ? '★' : '☆';
    $('stars').textContent = stars;
    $('stars').style.color = G.wanted > 0 ? '#ffd23e' : 'rgba(255,255,255,0.35)';
    // health
    $('healthfill').style.width = Math.max(0, G.player.health) + '%';
    $('healthfill').style.background = G.player.health > 40 ? '#4caf50' : '#e53935';
    // ammo / weapon
    const p = G.player;
    $('ammo').textContent = p.car ? '' : (p.weapon === 'pistol' ? `Pistol  ${p.magAmmo} / ∞` : 'Fists');
    // speed
    $('speed').textContent = p.car ? Math.round(Math.abs(p.car.speed) * 3.6) + ' km/h' : '';
    $('speed').style.display = p.car ? 'block' : 'none';
    // objective
    const M = G.mission;
    let obj = 'Explore Solara Bay';
    if (M.done) obj = 'Mission passed! Next job incoming…';
    else if (M.index >= 0) obj = M.text;
    $('objective').textContent = obj;
    const t = M.target;
    if (t && M.index >= 0 && !M.done) {
      const pp = p.car ? p.car.mesh.position : p.pos;
      $('objdist').textContent = Math.round(Math.hypot(pp.x - t.x, pp.z - t.z)) + ' m';
    } else $('objdist').textContent = '';
    // crosshair only on foot with the pistol out
    $('crosshair').style.display = (!p.car && p.weapon === 'pistol' && G.mode === 'playing')
      ? 'block' : 'none';
    // banner fade
    if (this.bannerT > 0) {
      this.bannerT -= dt;
      if (this.bannerT <= 0) $('banner').style.opacity = 0;
    }
    // hitmarker fade
    if (this.hitT > 0) {
      this.hitT -= dt;
      if (this.hitT <= 0) $('hitmarker').style.opacity = 0;
    }
    this.drawMinimap();
  }

  drawMinimap() {
    const G = this.G, ctx = this.map;
    const S = 200, W = 520; // world span shown: 520 m across a 200 px map,
    // so the whole city (480 m wide) fits with a small margin around it.
    const toX = (x) => (x + W / 2) / W * S;
    const toY = (z) => (z + W / 2) / W * S;
    ctx.clearRect(0, 0, S, S);
    // land + ocean
    ctx.fillStyle = '#1d3a4a';
    ctx.fillRect(0, 0, S, S);
    ctx.fillStyle = '#2c5a3a';
    ctx.fillRect(0, 0, S, toY(256));
    ctx.fillStyle = '#c9b078';
    ctx.fillRect(0, toY(256), S, toY(262) - toY(256));
    // roads
    ctx.strokeStyle = '#3a3f46';
    ctx.lineWidth = 5;
    for (const l of [-186, -124, -62, 0, 62, 124, 186]) {
      ctx.beginPath(); ctx.moveTo(toX(l), 0); ctx.lineTo(toX(l), S); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, toY(l)); ctx.lineTo(S, toY(l)); ctx.stroke();
    }
    // mission marker
    const M = G.mission;
    if (M.target && M.index >= 0 && !M.done) {
      const pulse = 4 + Math.sin(G.time * 4) * 1.5;
      ctx.fillStyle = '#ffd23e';
      ctx.beginPath();
      ctx.arc(toX(M.target.x), toY(M.target.z), pulse, 0, Math.PI * 2);
      ctx.fill();
    }
    // traffic
    ctx.fillStyle = '#9aa0a6';
    for (const t of G.traffic) ctx.fillRect(toX(t.car.x) - 1, toY(t.car.z) - 1, 2, 2);
    // police
    for (const u of G.policeCars) {
      ctx.fillStyle = Math.floor(G.time * 2.4) % 2 ? '#ff2222' : '#2255ff';
      ctx.beginPath(); ctx.arc(toX(u.car.x), toY(u.car.z), 3, 0, Math.PI * 2); ctx.fill();
    }
    for (const c of G.cops) {
      ctx.fillStyle = '#5588ff';
      ctx.fillRect(toX(c.x) - 1.5, toY(c.z) - 1.5, 3, 3);
    }
    // enemies
    ctx.fillStyle = '#ff4444';
    for (const e of G.enemies) if (!e.dead) {
      ctx.fillRect(toX(e.x) - 2, toY(e.z) - 2, 4, 4);
    }
    // player arrow
    const p = G.player;
    const px = p.car ? p.car.x : p.pos.x;
    const pz = p.car ? p.car.z : p.pos.z;
    const heading = p.car ? p.car.heading : p.heading;
    ctx.save();
    ctx.translate(toX(px), toY(pz));
    ctx.rotate(Math.PI - heading); // arrow points along the player's forward
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -6); ctx.lineTo(4.5, 5); ctx.lineTo(-4.5, 5); ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  showBanner(title, sub) {
    $('banner-title').textContent = title;
    $('banner-sub').textContent = sub || '';
    $('banner').style.opacity = 1;
    this.bannerT = 4;
  }

  showMessage(text, kind) {
    const el = document.createElement('div');
    el.className = 'msg ' + (kind || '');
    el.textContent = text;
    $('messages').appendChild(el);
    this.msgEls.push(el);
    while (this.msgEls.length > 5) this.msgEls.shift().remove();
    setTimeout(() => { el.style.opacity = 0; setTimeout(() => el.remove(), 600); }, 4200);
  }

  hitmarker(head) {
    const el = $('hitmarker');
    el.style.opacity = 1;
    el.style.color = head ? '#ff4444' : '#ffffff';
    this.hitT = 0.35;
  }

  showScreen(name) {
    for (const id of ['menu', 'pause', 'end']) $(id).classList.remove('show');
    if (name) $(name).classList.add('show');
  }

  showBusted(fine) {
    $('end-title').textContent = 'BUSTED';
    $('end-sub').textContent = `The Solara Bay PD took $${fine} in fines.`;
    $('end-btn').textContent = 'Walk free — respawn at the Hideout';
    this.showScreen('end');
  }

  showWasted(fee) {
    $('end-title').textContent = 'WASTED';
    $('end-sub').textContent = `The hospital patched you up. Bill: $${fee}.`;
    $('end-btn').textContent = 'Leave the hospital';
    this.showScreen('end');
  }
}
